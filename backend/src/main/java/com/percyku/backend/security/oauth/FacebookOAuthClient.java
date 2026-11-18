package com.percyku.backend.security.oauth;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;

/**
 * Facebook Login 的授權碼流程（manual flow）：
 * https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 *
 * <ul>
 * <li>帳號 ID 是這個 app 專用的 id（app-scoped user ID），同一個人在別的 app 是不同的 id。</li>
 * <li>email 只在使用者同意、而且帳號有可用的 email 時才回傳；用手機註冊的帳號可能沒有。Facebook 只回傳確認過的 email。</li>
 * <li>token 是我們以自己的 App Secret 用 code 換來的，不會是別的 app 的，所以不另外呼叫 debug_token。
 *     讀取資料時帶 appsecret_proof，token 外流也不能在沒有 App Secret 的地方使用。</li>
 * </ul>
 */
@Component
public class FacebookOAuthClient extends AbstractOAuthClient {

	public static final String PROVIDER = "facebook";
	static final String SCOPE = "email";

	public FacebookOAuthClient(AppProperties properties) {
		super(properties.facebook(), "Facebook", "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET");
	}

	@Override
	public String provider() {
		return PROVIDER;
	}

	@Override
	public String scope() {
		return isEnabled() ? SCOPE : "";
	}

	@Override
	public String noEmailMessage() {
		return "Facebook 沒有提供 Email，請改用其他方式註冊";
	}

	/** Facebook 不用 PKCE，codeVerifier 忽略。 */
	@Override
	public OAuthAccount exchange(String code, String redirectUri, String codeVerifier, String invalidMessage) {
		requireEnabled();
		// 參數值以樣板變數展開，才會完整編碼（code 可能含 + 等字元）
		var tokenUri = UriComponentsBuilder.fromUriString(tokenUrl)
				.queryParam("client_id", "{clientId}")
				.queryParam("client_secret", "{clientSecret}")
				.queryParam("redirect_uri", "{redirectUri}")
				.queryParam("code", "{code}")
				.encode()
				.buildAndExpand(Map.of("clientId", clientId, "clientSecret", clientSecret,
						"redirectUri", redirectUri, "code", code))
				.toUri();
		// code 無效時 Facebook 回 400 與 error 物件，由 call 轉成 400
		JsonNode tokenBody = call(() -> rest.get().uri(tokenUri).retrieve().body(JsonNode.class), invalidMessage);
		String accessToken = text(tokenBody, "access_token");
		if (accessToken == null) {
			logInfo("Facebook 換 token 的回應沒有 access_token");
			throw ApiException.badRequest(invalidMessage);
		}

		var meUri = UriComponentsBuilder.fromUriString(apiUrl + "/me")
				.queryParam("fields", "id,name,email")
				.queryParam("appsecret_proof", "{proof}")
				.encode()
				.buildAndExpand(Map.of("proof", appSecretProof(accessToken)))
				.toUri();
		JsonNode me = call(() -> rest.get().uri(meUri)
				.headers(headers -> headers.setBearerAuth(accessToken))
				.retrieve().body(JsonNode.class), invalidMessage);
		String id = text(me, "id");
		if (id == null) {
			logWarn("Facebook /me 的回應沒有 id");
			throw unavailable();
		}
		return new OAuthAccount(id, text(me, "email"), text(me, "name"));
	}

	/** HMAC-SHA256(access token, App Secret) 的 hex，見 Facebook 的 Securing Graph API Requests。 */
	String appSecretProof(String accessToken) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(clientSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return HexFormat.of().formatHex(mac.doFinal(accessToken.getBytes(StandardCharsets.UTF_8)));
		} catch (GeneralSecurityException e) {
			throw new IllegalStateException(e);
		}
	}
}
