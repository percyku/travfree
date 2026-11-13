package com.percyku.backend.service;

import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.PasswordChangeRequest;
import com.percyku.backend.dto.ProfileRequest;
import com.percyku.backend.dto.ProfileResponse;
import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.dto.SignupRequest;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.entity.UserIdentity;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserIdentityRepository;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.GoogleTokenVerifier;
import com.percyku.backend.security.JwtService;
import com.percyku.backend.security.LoginAttemptLimiter;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final LoginAttemptLimiter loginAttemptLimiter;
	private final UserIdentityRepository identityRepository;
	private final GoogleTokenVerifier googleTokenVerifier;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
			LoginAttemptLimiter loginAttemptLimiter, UserIdentityRepository identityRepository,
			GoogleTokenVerifier googleTokenVerifier) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.loginAttemptLimiter = loginAttemptLimiter;
		this.identityRepository = identityRepository;
		this.googleTokenVerifier = googleTokenVerifier;
	}

	/**
	 * @param clientIp 用於登入次數限制，取自 request.getRemoteAddr()
	 * @param requireAdmin 後台登入時為 true。密碼正確但沒有 ADMIN 時回 403，不計入失敗次數
	 */
	public SigninResult signin(SigninRequest request, String clientIp, boolean requireAdmin) {
		loginAttemptLimiter.checkAllowed(clientIp, request.username());
		User user = userRepository.findByEmail(request.username())
				// 沒有密碼的帳號（只用 Google 登入）與密碼錯誤相同，不透露帳號沒有密碼
				.filter(found -> found.hasPassword() && passwordEncoder.matches(request.password(), found.getPasswordHash()))
				.orElse(null);
		if (user == null) {
			loginAttemptLimiter.recordFailure(clientIp, request.username());
			throw ApiException.badRequest("登入失敗");
		}
		loginAttemptLimiter.recordSuccess(clientIp, request.username());
		if (requireAdmin && !user.hasRole(Role.ADMIN)) {
			throw ApiException.forbidden("此帳號沒有後台權限");
		}
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	/** 建立 USER 角色的帳號並直接登入。 */
	@Transactional
	public SigninResult signup(SignupRequest request) {
		if (isEmailTaken(request.email())) {
			throw emailTaken();
		}
		User user = new User(request.email(), passwordEncoder.encode(request.password()), request.name(),
				Set.of(Role.USER));
		try {
			userRepository.saveAndFlush(user);
		} catch (DataIntegrityViolationException e) {
			// 兩個請求同時註冊同一個 email
			throw emailTaken();
		}
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	/**
	 * email 已是某個帳號的 email，或已被某個帳號連結為第三方登入的 email，都視為已被使用。
	 * 連結的人通過了第三方驗證、擁有這個信箱；註冊不驗證 email，不能再用它建立另一個帳號，
	 * 否則同一個 email 用 Google 登入與用密碼登入會進到不同的帳號。
	 */
	public boolean isEmailTaken(String normalizedEmail) {
		return userRepository.existsByEmail(normalizedEmail) || identityRepository.existsByEmail(normalizedEmail);
	}

	@Transactional
	public void logout(String uid) {
		userRepository.findById(uid).ifPresent(User::revokeTokens);
	}

	/** token 已由 JwtAuthenticationFilter 驗證過；帳號在這之間被刪除時視為未登入。 */
	public User currentUser(String uid) {
		return userRepository.findById(uid)
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "驗證錯誤, 請重新登入"));
	}

	public ProfileResponse profile(String uid) {
		return profileOf(currentUser(uid));
	}

	public ProfileResponse profileOf(User user) {
		return ProfileResponse.from(user,
				identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE).orElse(null));
	}

	@Transactional
	public ProfileResponse updateProfile(String uid, ProfileRequest request) {
		User user = currentUser(uid);
		user.updateProfile(request.name(), request.tel(), request.address());
		return profileOf(user);
	}

	/**
	 * 目前的密碼錯誤計入登入失敗次數（與登入共用），否則拿到 token 的人可以用這支猜密碼。
	 * 成功後既有 token 全部失效，回傳新的 token 讓目前的裝置維持登入。
	 */
	@Transactional
	public SigninResult changePassword(String uid, PasswordChangeRequest request, String clientIp) {
		User user = currentUser(uid);
		if (!user.hasPassword()) {
			return setFirstPassword(user, request);
		}
		if (request.password() == null || request.password().isEmpty()) {
			throw ApiException.badRequest("password 屬性不得為空");
		}
		loginAttemptLimiter.checkAllowed(clientIp, user.getEmail());
		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			loginAttemptLimiter.recordFailure(clientIp, user.getEmail());
			throw ApiException.badRequest("目前的密碼不正確");
		}
		loginAttemptLimiter.recordSuccess(clientIp, user.getEmail());
		if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
			throw ApiException.badRequest("新密碼不能與目前的密碼相同");
		}
		user.changePassword(passwordEncoder.encode(request.newPassword()));
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	/**
	 * 只用 Google 登入的帳號第一次設定密碼。沒有目前的密碼可以驗證，所以要重新以已連結的 Google 帳號驗證，
	 * 否則拿到 token 的人就能偷設密碼，之後一直登得進來。
	 */
	private SigninResult setFirstPassword(User user, PasswordChangeRequest request) {
		if (request.credential() == null || request.credential().isBlank()) {
			throw ApiException.badRequest("credential 屬性不得為空");
		}
		String invalid = "Google 驗證失敗，請以已連結的 Google 帳號驗證";
		GoogleTokenVerifier.GoogleAccount google = googleTokenVerifier.verify(request.credential(), invalid);
		boolean linked = identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE)
				.map(identity -> identity.getSubject().equals(google.subject()))
				.orElse(false);
		if (!linked) {
			throw ApiException.badRequest(invalid);
		}
		user.changePassword(passwordEncoder.encode(request.newPassword()));
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	/** 包含只用 Google 登入的帳號，所以提示改用原本的方式。 */
	private static ApiException emailTaken() {
		return ApiException.badRequest("此 Email 已註冊，請改用原本的方式登入（例如 Google）");
	}

	/** 給 Google 登入共用：發 token 給已確認身分的帳號。 */
	SigninResult issue(User user) {
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	public record SigninResult(String uid, JwtService.IssuedToken token) {
	}
}
