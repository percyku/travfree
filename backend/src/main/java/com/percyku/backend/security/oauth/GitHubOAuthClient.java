package com.percyku.backend.security.oauth;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

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
public class GitHubOAuthClient implements OAuthClient {

	public static final String PROVIDER = "github";
	static final String SCOPE = "user:email";
	static final String INVALID = "GitHub 驗證失敗，請再試一次";
	static final String UNAVAILABLE = "GitHub 暫時無法連線，請稍後再試";
	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

	private static final Logger log = LoggerFactory.getLogger(GitHubOAuthClient.class);

	private final String clientId;
	private final String clientSecret;
	private final String authorizeUrl;
	private final String tokenUrl;
	private final String apiUrl;
	private final RestClient rest;

	public GitHubOAuthClient(AppProperties properties) {
		AppProperties.OAuthProvider github = properties.github() == null
				? new AppProperties.OAuthProvider(null, null, null, null, null)
				: properties.github();
		this.clientId = strip(github.clientId());
		this.clientSecret = strip(github.clientSecret());
		if (clientId.isEmpty() != clientSecret.isEmpty()) {
			throw new IllegalStateException("GITHUB_CLIENT_ID 與 GITHUB_CLIENT_SECRET 要一起設定");
		}
		this.authorizeUrl = isEnabled() ? strip(github.authorizeUrl()) : "";
		this.tokenUrl = isEnabled() ? strip(github.tokenUrl()) : "";
		this.apiUrl = isEnabled() ? strip(github.apiUrl()).replaceAll("/+$", "") : "";

		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
				.version(HttpClient.Version.HTTP_1_1)
				.connectTimeout(CONNECT_TIMEOUT)
				.build());
		factory.setReadTimeout(READ_TIMEOUT);
		this.rest = RestClient.builder()
				.requestFactory(factory)
				// GitHub API 要求 User-Agent
				.defaultHeader(HttpHeaders.USER_AGENT, "FreeTrav")
				.build();
	}

	@Override
	public String provider() {
		return PROVIDER;
	}

	@Override
	public boolean isEnabled() {
		return !clientId.isEmpty();
	}

	@Override
	public String clientId() {
		return clientId;
	}

	@Override
	public String authorizeUrl() {
		return authorizeUrl;
	}

	@Override
	public String scope() {
		return isEnabled() ? SCOPE : "";
	}

	@Override
	public OAuthAccount exchange(String code, String redirectUri, String codeVerifier, String invalidMessage) {
		if (!isEnabled()) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "未設定 GitHub 登入");
		}
		String accessToken = accessToken(code, redirectUri, codeVerifier, invalidMessage);
		JsonNode user = call(() -> rest.get().uri(apiUrl + "/user")
				.headers(headers -> apiHeaders(headers, accessToken))
				.retrieve().body(JsonNode.class), invalidMessage);
		if (user == null || !user.path("id").canConvertToLong()) {
			log.warn("GitHub /user 的回應沒有 id");
			throw new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
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
		String token = body == null ? null : text(body, "access_token");
		if (token == null) {
			// 不記錄 code 與 token，只記錄 GitHub 的錯誤代碼（例如 bad_verification_code）
			log.info("GitHub 換 token 失敗: {}", body == null ? "沒有回應內容" : body.path("error").asText("沒有 access_token"));
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
			if (e.getStatus() == HttpStatus.BAD_REQUEST) {
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

	/** 4xx → 400（code 或 token 無效）；5xx、逾時、連不上、回應無法解析 → 502。 */
	private static <T> T call(Supplier<T> request, String invalidMessage) {
		try {
			return request.get();
		} catch (HttpClientErrorException e) {
			log.info("GitHub 回應 {}", e.getStatusCode().value());
			throw ApiException.badRequest(invalidMessage);
		} catch (RestClientException e) {
			log.warn("無法連線 GitHub: {}", e.getMessage());
			throw new ApiException(HttpStatus.BAD_GATEWAY, UNAVAILABLE);
		}
	}

	private static String text(JsonNode node, String field) {
		JsonNode value = node.get(field);
		if (value == null || !value.isTextual() || value.asText().isBlank()) {
			return null;
		}
		return value.asText().strip();
	}

	private static String strip(String value) {
		return value == null ? "" : value.strip();
	}
}
