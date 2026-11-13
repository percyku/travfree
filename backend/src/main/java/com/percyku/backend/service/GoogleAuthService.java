package com.percyku.backend.service;

import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.ProfileResponse;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.entity.UserIdentity;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserIdentityRepository;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.GoogleTokenVerifier;
import com.percyku.backend.security.GoogleTokenVerifier.GoogleAccount;

/**
 * Google 登入、註冊與連結。以 Google 的 sub 辨識，<b>email 相同也不自動合併</b>：
 * 註冊不驗證 email，自動合併會讓先用別人 email 註冊的人，在本人以 Google 登入後仍能用密碼登入（搶先註冊攻擊）。
 */
@Service
public class GoogleAuthService {

	private final GoogleTokenVerifier verifier;
	private final UserRepository userRepository;
	private final UserIdentityRepository identityRepository;
	private final AuthService authService;

	public GoogleAuthService(GoogleTokenVerifier verifier, UserRepository userRepository,
			UserIdentityRepository identityRepository, AuthService authService) {
		this.verifier = verifier;
		this.userRepository = userRepository;
		this.identityRepository = identityRepository;
		this.authService = authService;
	}

	/** 已連結的 Google 帳號登入；新的 email 建立帳號（created 為 true）；email 已有帳號回 409。 */
	@Transactional
	public Result signin(String credential) {
		GoogleAccount google = verifier.verify(credential);
		var linked = identityRepository.findByProviderAndSubject(UserIdentity.GOOGLE, google.subject());
		if (linked.isPresent()) {
			return new Result(authService.issue(linked.get().getUser()), false);
		}
		if (!google.emailVerified() || google.email() == null || google.email().isBlank()) {
			throw ApiException.badRequest("Google 帳號的 Email 尚未驗證");
		}
		String email = User.normalizeEmail(google.email());
		if (authService.isEmailTaken(email)) {
			throw emailTaken();
		}
		User user = new User(email, null, nameOf(google, email), Set.of(Role.USER));
		try {
			userRepository.saveAndFlush(user);
			identityRepository.saveAndFlush(new UserIdentity(user, UserIdentity.GOOGLE, google.subject(), email));
		} catch (DataIntegrityViolationException e) {
			// 同時有兩個請求以同一個 email 或同一個 Google 帳號註冊
			throw emailTaken();
		}
		return new Result(authService.issue(user), true);
	}

	@Transactional
	public ProfileResponse link(String uid, String credential) {
		User user = authService.currentUser(uid);
		GoogleAccount google = verifier.verify(credential);
		var existing = identityRepository.findByProviderAndSubject(UserIdentity.GOOGLE, google.subject());
		if (existing.isPresent()) {
			if (!existing.get().getUser().getId().equals(uid)) {
				throw new ApiException(HttpStatus.CONFLICT, "這個 Google 帳號已連結其他會員");
			}
			return authService.profileOf(user);
		}
		if (identityRepository.findByUserIdAndProvider(uid, UserIdentity.GOOGLE).isPresent()) {
			throw new ApiException(HttpStatus.CONFLICT, "已連結其他 Google 帳號，請先解除連結");
		}
		try {
			identityRepository.saveAndFlush(new UserIdentity(user, UserIdentity.GOOGLE, google.subject(),
					google.email() == null ? null : User.normalizeEmail(google.email())));
		} catch (DataIntegrityViolationException e) {
			throw new ApiException(HttpStatus.CONFLICT, "這個 Google 帳號已連結其他會員");
		}
		return authService.profileOf(user);
	}

	/** 至少保留一種登入方式。之後加 GitHub 等平台時，「還有其他已連結的平台」也算。 */
	@Transactional
	public ProfileResponse unlink(String uid) {
		User user = authService.currentUser(uid);
		var identity = identityRepository.findByUserIdAndProvider(uid, UserIdentity.GOOGLE);
		if (identity.isPresent()) {
			if (!user.hasPassword()) {
				throw ApiException.badRequest("至少要保留一種登入方式，請先設定密碼");
			}
			identityRepository.delete(identity.get());
			identityRepository.flush();
		}
		return authService.profileOf(user);
	}

	private static String nameOf(GoogleAccount google, String email) {
		String name = google.name() == null ? "" : google.name().strip();
		if (name.isEmpty()) {
			return User.defaultName(email);
		}
		return name.length() > User.NAME_MAX_LENGTH ? name.substring(0, User.NAME_MAX_LENGTH) : name;
	}

	private static ApiException emailTaken() {
		return new ApiException(HttpStatus.CONFLICT, "此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google");
	}

	public record Result(AuthService.SigninResult signin, boolean created) {
	}
}
