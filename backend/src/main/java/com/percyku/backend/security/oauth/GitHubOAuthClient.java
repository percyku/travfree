package com.percyku.backend.security.oauth;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;

/**
 * GitHub OAuth App 的授權碼流程：
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 *
 * <ul>
 * <li>帳號 ID 用數字 id，不用 login（使用者名稱可以改）。</li>
 * <li>email 只採用 /user/emails 中 primary 且 verified 的；/user 的 email 是使用者選擇公開的，可能沒有或未驗證。</li>
 * </ul>
 */
@Component
public class GitHubOAuthClient extends AbstractOAuthClient {

	public static final String PROVIDER = "github";
	static final String SCOPE = "user:email";
	static final String INVALID = "GitHub 驗證失敗，請再試一次";

	public GitHubOAuthClient(AppProperties properties) {
		super(properties.github(), "GitHub", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");
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
		return "GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊";
	}

	@Override
	public OAuthAccount exchange(String code, String redirectUri, String codeVerifier, String invalidMessage) {
		requireEnabled();
		String accessToken = accessToken(code, redirectUri, codeVerifier, invalidMessage);
		JsonNode user = call(() -> rest.get().uri(apiUrl + "/user")
				.headers(headers -> apiHeaders(headers, accessToken))
				.retrieve().body(JsonNode.class), invalidMessage);
		if (user == null || !user.path("id").canConvertToLong()) {
			logWarn("GitHub /user 的回應沒有 id");
			throw unavailable();
		}
		String name = text(user, "name");
		return new OAuthAccount(user.get("id").asText(), verifiedPrimaryEmail(accessToken),
				name == null ? text(user, "login") : name);
	}

	/** GitHub 在 code 無效時回 200 與 error 欄位，不是 4xx。 */
	private String accessToken(String code, String redirectUri, String codeVerifier, String invalidMessage) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("client_id", clientId);
		form.add("client_secret", clientSecret);
		form.add("code", code);
		form.add("redirect_uri", redirectUri);
		if (codeVerifier != null && !codeVerifier.isBlank()) {
			form.add("code_verifier", codeVerifier);
		}
		JsonNode body = call(() -> rest.post().uri(tokenUrl)
				.accept(MediaType.APPLICATION_JSON)
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.body(form)
				.retrieve().body(JsonNode.class), invalidMessage);
		String token = text(body, "access_token");
		if (token == null) {
			// 只記錄 GitHub 的錯誤代碼（例如 bad_verification_code）
			logInfo("GitHub 換 token 失敗: {}", body == null ? "沒有回應內容" : body.path("error").asText("沒有 access_token"));
			throw ApiException.badRequest(invalidMessage);
		}
		return token;
	}

	/** 沒有 user:email 權限等 4xx 時視為沒有 email，由呼叫端決定能不能繼續。 */
	private String verifiedPrimaryEmail(String accessToken) {
		JsonNode emails;
		try {
			emails = call(() -> rest.get().uri(apiUrl + "/user/emails")
					.headers(headers -> apiHeaders(headers, accessToken))
					.retrieve().body(JsonNode.class), INVALID);
		} catch (ApiException e) {
			if (e.getStatus().is4xxClientError()) {
				return null;
			}
			throw e;
		}
		if (emails == null || !emails.isArray()) {
			return null;
		}
		for (JsonNode email : emails) {
			if (email.path("primary").asBoolean() && email.path("verified").asBoolean()) {
				return text(email, "email");
			}
		}
		return null;
	}

	private static void apiHeaders(HttpHeaders headers, String accessToken) {
		headers.setBearerAuth(accessToken);
		headers.set(HttpHeaders.ACCEPT, "application/vnd.github+json");
		headers.set("X-GitHub-Api-Version", "2022-11-28");
	}
}
