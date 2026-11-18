package com.percyku.backend.service;

import org.springframework.stereotype.Service;

import com.percyku.backend.dto.OAuthCodeRequest;
import com.percyku.backend.dto.ProfileResponse;
import com.percyku.backend.security.oauth.OAuthClient;
import com.percyku.backend.security.oauth.OAuthProviders;

/**
 * GitHub、Facebook 的登入、註冊與連結：以 code 向平台取得帳號資料後交給 IdentityService，規則見那裡。
 * 連線平台不在資料庫交易裡，交易只包住 IdentityService 的部分。
 */
@Service
public class OAuthAuthService {

	private final OAuthProviders providers;
	private final IdentityService identityService;

	public OAuthAuthService(OAuthProviders providers, IdentityService identityService) {
		this.providers = providers;
		this.identityService = identityService;
	}

	public IdentityService.Result signin(String provider, OAuthCodeRequest request) {
		String name = OAuthProviders.displayName(provider);
		return identityService.signin(verify(provider, request), name + " 帳號沒有已驗證的 Email，請改用其他方式註冊");
	}

	public ProfileResponse link(String uid, String provider, OAuthCodeRequest request) {
		return identityService.link(uid, verify(provider, request));
	}

	/** 後端沒有設定這個平台時也可以解除，只檢查是不是支援的平台。 */
	public ProfileResponse unlink(String uid, String provider) {
		OAuthProviders.displayName(provider);
		return identityService.unlink(uid, provider);
	}

	private IdentityService.VerifiedAccount verify(String provider, OAuthCodeRequest request) {
		String name = OAuthProviders.displayName(provider);
		OAuthClient client = providers.require(provider);
		OAuthClient.OAuthAccount account = client.exchange(request.code(), request.redirectUri(),
				request.codeVerifier(), name + " 驗證失敗，請再試一次");
		return new IdentityService.VerifiedAccount(provider, name, account.subject(), account.email(), account.name());
	}
}
