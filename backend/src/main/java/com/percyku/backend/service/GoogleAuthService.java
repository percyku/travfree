package com.percyku.backend.service;

import org.springframework.stereotype.Service;

import com.percyku.backend.dto.ProfileResponse;
import com.percyku.backend.entity.UserIdentity;
import com.percyku.backend.security.GoogleTokenVerifier;
import com.percyku.backend.security.GoogleTokenVerifier.GoogleAccount;

/** Google 登入、註冊與連結：驗證 ID token 後交給 IdentityService，規則見那裡。 */
@Service
public class GoogleAuthService {

	private static final String DISPLAY_NAME = "Google";

	private final GoogleTokenVerifier verifier;
	private final IdentityService identityService;

	public GoogleAuthService(GoogleTokenVerifier verifier, IdentityService identityService) {
		this.verifier = verifier;
		this.identityService = identityService;
	}

	public IdentityService.Result signin(String credential) {
		return identityService.signin(toAccount(verifier.verify(credential)), "Google 帳號的 Email 尚未驗證");
	}

	public ProfileResponse link(String uid, String credential) {
		return identityService.link(uid, toAccount(verifier.verify(credential)));
	}

	public ProfileResponse unlink(String uid) {
		return identityService.unlink(uid, UserIdentity.GOOGLE);
	}

	/** 未驗證的 email 不能用來建立帳號，也不記錄（已連結的 email 會擋住別人註冊，只能記錄確認過的）。 */
	private static IdentityService.VerifiedAccount toAccount(GoogleAccount google) {
		return new IdentityService.VerifiedAccount(UserIdentity.GOOGLE, DISPLAY_NAME, google.subject(),
				google.emailVerified() ? google.email() : null, google.name());
	}
}
