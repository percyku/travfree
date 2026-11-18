package com.percyku.backend.security.oauth;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.percyku.backend.exception.ApiException;

/**
 * /api/user/oauth/{provider} 支援的平台。還沒實作的平台（沒有 OAuthClient）視同未設定，回 503。
 * Google 用 ID token，有自己的端點，不在這裡。
 */
@Component
public class OAuthProviders {

	public static final String NOT_FOUND = "找不到這個登入方式";

	/** provider → 訊息中的平台名稱，順序即 /api/user/oauth/config 的順序。 */
	private static final Map<String, String> DISPLAY_NAMES = new LinkedHashMap<>();

	static {
		DISPLAY_NAMES.put("github", "GitHub");
		DISPLAY_NAMES.put("facebook", "Facebook");
	}

	private final Map<String, OAuthClient> clients;

	public OAuthProviders(List<OAuthClient> clients) {
		this.clients = clients.stream().collect(Collectors.toMap(OAuthClient::provider, Function.identity()));
	}

	public static List<String> names() {
		return List.copyOf(DISPLAY_NAMES.keySet());
	}

	/** @throws ApiException 404 不支援的平台 */
	public static String displayName(String provider) {
		String name = provider == null ? null : DISPLAY_NAMES.get(provider);
		if (name == null) {
			throw ApiException.notFound(NOT_FOUND);
		}
		return name;
	}

	/** 沒有實作或沒有設定時為 empty。 */
	public Optional<OAuthClient> find(String provider) {
		return Optional.ofNullable(clients.get(provider)).filter(OAuthClient::isEnabled);
	}

	/** @throws ApiException 404 不支援的平台；503 沒有設定 */
	public OAuthClient require(String provider) {
		String name = displayName(provider);
		return find(provider)
				.orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "未設定 " + name + " 登入"));
	}
}
