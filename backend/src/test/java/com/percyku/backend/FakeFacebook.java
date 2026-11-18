package com.percyku.backend;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * 測試用的 Facebook：以 JDK 的 HttpServer 模擬 Graph API 的換 token（GET /oauth/access_token）與 GET /me。
 * 行為比照 Facebook：code 無效、已使用或 redirect_uri 不符時回 400 與 error 物件；
 * /me 要帶正確的 appsecret_proof（HMAC-SHA256(token, App Secret)），否則 400。
 */
final class FakeFacebook {

	static final String APP_ID = "1234567890123456";
	static final String APP_SECRET = "test-facebook-secret";
	static final String REDIRECT_URI = "http://localhost:5173/";

	private static final ObjectMapper JSON = new ObjectMapper();

	private final HttpServer server;
	private final Map<String, Grant> grants = new ConcurrentHashMap<>();
	private final Map<String, User> tokens = new ConcurrentHashMap<>();
	private volatile Map<String, String> lastTokenQuery = Map.of();
	private volatile Map<String, String> lastMeQuery = Map.of();
	private volatile int tokenStatus = 200;

	private FakeFacebook(HttpServer server) {
		this.server = server;
	}

	static FakeFacebook start() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			FakeFacebook fake = new FakeFacebook(server);
			server.createContext("/oauth/access_token", fake::token);
			server.createContext("/me", fake::me);
			server.start();
			return fake;
		} catch (IOException e) {
			throw new IllegalStateException(e);
		}
	}

	String baseUrl() {
		return "http://127.0.0.1:" + server.getAddress().getPort();
	}

	void reset() {
		grants.clear();
		tokens.clear();
		lastTokenQuery = Map.of();
		lastMeQuery = Map.of();
		tokenStatus = 200;
	}

	void failToken(int status) {
		tokenStatus = status;
	}

	/** 最後一次換 token 的 query（已解碼） */
	Map<String, String> lastTokenQuery() {
		return lastTokenQuery;
	}

	Map<String, String> lastMeQuery() {
		return lastMeQuery;
	}

	/** 使用者在 Facebook 授權後拿到的 code，以預設的 redirect_uri */
	String authorize(User user) {
		return authorize(user, "code-" + UUID.randomUUID());
	}

	/** 指定 code 的內容，用來測含特殊字元的 code */
	String authorize(User user, String code) {
		grants.put(code, new Grant(user, REDIRECT_URI));
		return code;
	}

	/** @param email 使用者沒有提供 email 時為 null */
	static User user(String id, String name, String email) {
		return new User(id, name, email);
	}

	static String proof(String accessToken) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(APP_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return HexFormat.of().formatHex(mac.doFinal(accessToken.getBytes(StandardCharsets.UTF_8)));
		} catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	private void token(HttpExchange exchange) throws IOException {
		Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
		lastTokenQuery = query;
		if (tokenStatus != 200) {
			respond(exchange, tokenStatus, error("Service temporarily unavailable", 2));
			return;
		}
		if (!"GET".equals(exchange.getRequestMethod()) || !APP_ID.equals(query.get("client_id"))
				|| !APP_SECRET.equals(query.get("client_secret"))) {
			respond(exchange, 400, error("Error validating client secret.", 1));
			return;
		}
		Grant grant = grants.remove(String.valueOf(query.get("code"))); // code 只能用一次
		if (grant == null || !grant.redirectUri().equals(query.get("redirect_uri"))) {
			respond(exchange, 400, error("Invalid verification code format.", 100));
			return;
		}
		String accessToken = "EAA" + UUID.randomUUID().toString().replace("-", "");
		tokens.put(accessToken, grant.user());
		respond(exchange, 200, Map.of("access_token", accessToken, "token_type", "bearer", "expires_in", 5183944));
	}

	private void me(HttpExchange exchange) throws IOException {
		Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
		lastMeQuery = query;
		String auth = exchange.getRequestHeaders().getFirst("Authorization");
		String accessToken = auth == null ? null : auth.replaceFirst("^Bearer ", "");
		User user = accessToken == null ? null : tokens.get(accessToken);
		if (user == null) {
			respond(exchange, 400, error("Invalid OAuth access token.", 190));
			return;
		}
		if (!proof(accessToken).equals(query.get("appsecret_proof"))) {
			respond(exchange, 400, error("Invalid appsecret_proof provided in the API argument", 100));
			return;
		}
		Map<String, Object> body = new HashMap<>();
		body.put("id", user.id());
		body.put("name", user.name());
		// 沒有 email（或沒有要求 email 欄位）時 Facebook 不回傳這個欄位
		if (user.email() != null && String.valueOf(query.get("fields")).contains("email")) {
			body.put("email", user.email());
		}
		respond(exchange, 200, body);
	}

	private static Map<String, Object> error(String message, int code) {
		return Map.of("error", Map.of("message", message, "type", "OAuthException", "code", code));
	}

	private static Map<String, String> parseQuery(String raw) {
		Map<String, String> query = new HashMap<>();
		if (raw == null) {
			return query;
		}
		for (String pair : raw.split("&")) {
			int eq = pair.indexOf('=');
			String key = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
			String value = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
			query.put(key, value);
		}
		return query;
	}

	private static void respond(HttpExchange exchange, int status, Object body) throws IOException {
		byte[] bytes = JSON.writeValueAsBytes(body);
		exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
		exchange.sendResponseHeaders(status, bytes.length);
		try (OutputStream out = exchange.getResponseBody()) {
			out.write(bytes);
		}
	}

	record User(String id, String name, String email) {
	}

	private record Grant(User user, String redirectUri) {
	}
}
