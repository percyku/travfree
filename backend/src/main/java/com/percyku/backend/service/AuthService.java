package com.percyku.backend.service;

import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.dto.SignupRequest;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.JwtService;
import com.percyku.backend.security.LoginAttemptLimiter;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final LoginAttemptLimiter loginAttemptLimiter;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
			LoginAttemptLimiter loginAttemptLimiter) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.loginAttemptLimiter = loginAttemptLimiter;
	}

	/**
	 * @param clientIp 用於登入次數限制，取自 request.getRemoteAddr()
	 * @param requireAdmin 後台登入時為 true。密碼正確但沒有 ADMIN 時回 403，不計入失敗次數
	 */
	public SigninResult signin(SigninRequest request, String clientIp, boolean requireAdmin) {
		loginAttemptLimiter.checkAllowed(clientIp, request.username());
		User user = userRepository.findByEmail(request.username())
				.filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
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
		if (userRepository.existsByEmail(request.email())) {
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

	@Transactional
	public void logout(String uid) {
		userRepository.findById(uid).ifPresent(User::revokeTokens);
	}

	/** token 已由 JwtAuthenticationFilter 驗證過；帳號在這之間被刪除時視為未登入。 */
	public User currentUser(String uid) {
		return userRepository.findById(uid)
				.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "驗證錯誤, 請重新登入"));
	}

	private static ApiException emailTaken() {
		return ApiException.badRequest("此 Email 已註冊");
	}

	public record SigninResult(String uid, JwtService.IssuedToken token) {
	}
}
