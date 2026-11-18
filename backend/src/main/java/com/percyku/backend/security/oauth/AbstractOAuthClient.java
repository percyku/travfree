package com.percyku.backend.security.oauth;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;

/**
 * GitHub、Facebook 共用：設定（client ID 與 secret 要一起設定）、HTTP client（逾時）與錯誤對應。
 * 平台回 4xx 視為 code 或 token 無效（400）；5xx、逾時、連不上、回應無法解析視為平台故障（502）。
 */
abstract class AbstractOAuthClient implements OAuthClient {

	private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
	private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

	private final Logger log = LoggerFactory.getLogger(getClass());

	protected final String clientId;
	protected final String clientSecret;
	protected final String authorizeUrl;
	protected final String tokenUrl;
	/** 結尾沒有 / */
	protected final String apiUrl;
	protected final RestClient rest;
	private final String displayName;

	/**
	 * @param idEnv、secretEnv 只用在設定不完整時的錯誤訊息
	 */
	protected AbstractOAuthClient(AppProperties.OAuthProvider config, String displayName, String idEnv,
			String secretEnv) {
		AppProperties.OAuthProvider settings = config == null
				? new AppProperties.OAuthProvider(null, null, null, null, null)
				: config;
		this.displayName = displayName;
		this.clientId = strip(settings.clientId());
		this.clientSecret = strip(settings.clientSecret());
		if (clientId.isEmpty() != clientSecret.isEmpty()) {
			throw new IllegalStateException(idEnv + " 與 " + secretEnv + " 要一起設定");
		}
		this.authorizeUrl = isEnabled() ? strip(settings.authorizeUrl()) : "";
		this.tokenUrl = isEnabled() ? strip(settings.tokenUrl()) : "";
		this.apiUrl = isEnabled() ? strip(settings.apiUrl()).replaceAll("/+$", "") : "";

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

	protected void requireEnabled() {
		if (!isEnabled()) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "未設定 " + displayName + " 登入");
		}
	}

	protected ApiException unavailable() {
		return new ApiException(HttpStatus.BAD_GATEWAY, displayName + " 暫時無法連線，請稍後再試");
	}

	/** 不記錄 code 與 token，只記錄狀態碼與平台的錯誤說明。 */
	protected <T> T call(Supplier<T> request, String invalidMessage) {
		try {
			return request.get();
		} catch (HttpClientErrorException e) {
			log.info("{} 回應 {}", displayName, e.getStatusCode().value());
			throw ApiException.badRequest(invalidMessage);
		} catch (RestClientException e) {
			log.warn("無法連線 {}: {}", displayName, e.getMessage());
			throw unavailable();
		}
	}

	protected void logInfo(String message, Object... args) {
		log.info(message, args);
	}

	protected void logWarn(String message, Object... args) {
		log.warn(message, args);
	}

	/** 欄位是非空白的字串時回傳去掉前後空白的值，否則 null。 */
	protected static String text(JsonNode node, String field) {
		JsonNode value = node == null ? null : node.get(field);
		if (value == null || !value.isTextual() || value.asText().isBlank()) {
			return null;
		}
		return value.asText().strip();
	}

	private static String strip(String value) {
		return value == null ? "" : value.strip();
	}
}
