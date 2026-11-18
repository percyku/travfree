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

/**
 * 第三方登入（Google、GitHub、Facebook）共用的登入、註冊、連結與解除。平台的驗證由呼叫端完成。
 *
 * <p>以平台的帳號 ID（subject）辨識，<b>email 相同也不自動合併</b>：註冊不驗證 email，
 * 自動合併會讓先用別人 email 註冊的人，在本人以第三方登入後仍能用密碼登入（搶先註冊攻擊）。
 */
@Service
public class IdentityService {

	private final UserRepository userRepository;
	private final UserIdentityRepository identityRepository;
	private final AuthService authService;

	public IdentityService(UserRepository userRepository, UserIdentityRepository identityRepository,
			AuthService authService) {
		this.userRepository = userRepository;
		this.identityRepository = identityRepository;
		this.authService = authService;
	}

	/**
	 * 已連結的平台帳號登入；新的 email 建立帳號（created 為 true）；email 已有帳號回 409。
	 *
	 * @param noEmailMessage 要建立帳號但 account.email() 為 null 時的訊息
	 */
	@Transactional
	public Result signin(VerifiedAccount account, String noEmailMessage) {
		var linked = identityRepository.findByProviderAndSubject(account.provider(), account.subject());
		if (linked.isPresent()) {
			return new Result(authService.issue(linked.get().getUser()), false);
		}
		if (account.email() == null || account.email().isBlank()) {
			throw ApiException.badRequest(noEmailMessage);
		}
		String email = User.normalizeEmail(account.email());
		if (authService.isEmailTaken(email)) {
			throw emailTaken(account);
		}
		User user = new User(email, null, nameOf(account.name(), email), Set.of(Role.USER));
		try {
			userRepository.saveAndFlush(user);
			identityRepository.saveAndFlush(new UserIdentity(user, account.provider(), account.subject(), email));
		} catch (DataIntegrityViolationException e) {
			// 同時有兩個請求以同一個 email 或同一個平台帳號註冊
			throw emailTaken(account);
		}
		return new Result(authService.issue(user), true);
	}

	/** 平台的 email 可以與帳號的不同，也可以沒有（帳號本身已有 email）。 */
	@Transactional
	public ProfileResponse link(String uid, VerifiedAccount account) {
		User user = authService.currentUser(uid);
		var existing = identityRepository.findByProviderAndSubject(account.provider(), account.subject());
		if (existing.isPresent()) {
			if (!existing.get().getUser().getId().equals(uid)) {
				throw linkedToOther(account);
			}
			return authService.profileOf(user);
		}
		if (identityRepository.findByUserIdAndProvider(uid, account.provider()).isPresent()) {
			throw new ApiException(HttpStatus.CONFLICT, "已連結其他 " + account.displayName() + " 帳號，請先解除連結");
		}
		try {
			identityRepository.saveAndFlush(new UserIdentity(user, account.provider(), account.subject(),
					account.email() == null || account.email().isBlank() ? null : User.normalizeEmail(account.email())));
		} catch (DataIntegrityViolationException e) {
			throw linkedToOther(account);
		}
		return authService.profileOf(user);
	}

	/** 至少保留一種登入方式：密碼，或其他已連結的平台。沒有連結時不做事。 */
	@Transactional
	public ProfileResponse unlink(String uid, String provider) {
		User user = authService.currentUser(uid);
		var identity = identityRepository.findByUserIdAndProvider(uid, provider);
		if (identity.isPresent()) {
			if (!user.hasPassword() && identityRepository.countByUserId(uid) <= 1) {
				throw ApiException.badRequest("至少要保留一種登入方式，請先設定密碼");
			}
			identityRepository.delete(identity.get());
			identityRepository.flush();
		}
		return authService.profileOf(user);
	}

	/** 平台沒有給姓名時取 email 的 @ 前面，超過上限截斷。 */
	private static String nameOf(String platformName, String email) {
		String name = platformName == null ? "" : platformName.strip();
		if (name.isEmpty()) {
			return User.defaultName(email);
		}
		return name.length() > User.NAME_MAX_LENGTH ? name.substring(0, User.NAME_MAX_LENGTH) : name;
	}

	private static ApiException emailTaken(VerifiedAccount account) {
		return new ApiException(HttpStatus.CONFLICT,
				"此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 " + account.displayName());
	}

	private static ApiException linkedToOther(VerifiedAccount account) {
		return new ApiException(HttpStatus.CONFLICT, "這個 " + account.displayName() + " 帳號已連結其他會員");
	}

	/**
	 * 已通過平台驗證的帳號。
	 *
	 * @param provider 資料表的 provider，例如 google、github
	 * @param displayName 訊息中的平台名稱，例如 GitHub
	 * @param email 可以用來建立帳號的 email（已驗證），沒有時為 null
	 */
	public record VerifiedAccount(String provider, String displayName, String subject, String email, String name) {
	}

	public record Result(AuthService.SigninResult signin, boolean created) {
	}
}
