package com.percyku.backend;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * 測試用的 GitHub：以 JDK 的 HttpServer 模擬 OAuth 的換 token 與 /user、/user/emails，
 * 讓整合測試走真的 HTTP（含錯誤狀態碼與回應格式）。行為比照 GitHub 文件：
 * code 無效、已使用、redirect_uri 或 code_verifier 不符時回 200 與 error 欄位。
 */
final class FakeGitHub {

	static final String CLIENT_ID = "test-github-client";
	static final String CLIENT_SECRET = "test-github-secret";
	static final String REDIRECT_URI = "http://localhost:5173/";

	private static final ObjectMapper JSON = new ObjectMapper();

	private final HttpServer server;
	private final Map<String, Grant> grants = new ConcurrentHashMap<>();
	private final Map<String, Grant> tokens = new ConcurrentHashMap<>();
	private final List<Map<String, String>> tokenRequests = Collections.synchronizedList(new ArrayList<>());
	private volatile int tokenStatus = 200;
	private volatile int userStatus = 200;
	private volatile int emailsStatus = 200;

	private FakeGitHub(HttpServer server) {
		this.server = server;
	}

	static FakeGitHub start() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			FakeGitHub fake = new FakeGitHub(server);
			server.createContext("/login/oauth/access_token", fake::token);
			server.createContext("/user", fake::user);
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
		tokenRequests.clear();
		tokenStatus = 200;
		userStatus = 200;
		emailsStatus = 200;
	}

	/** 模擬 GitHub 故障：換 token、/user 或 /user/emails 回這個狀態碼 */
	void failToken(int status) {
		tokenStatus = status;
	}

	void failUser(int status) {
		userStatus = status;
	}

	void failEmails(int status) {
		emailsStatus = status;
	}

	/** 最後一次換 token 的表單內容 */
	Map<String, String> lastTokenRequest() {
		return tokenRequests.isEmpty() ? Map.of() : tokenRequests.get(tokenRequests.size() - 1);
	}

	/** 使用者在 GitHub 授權後拿到的 code，以預設的 redirect_uri、不用 PKCE */
	String authorize(User user) {
		return authorize(user, REDIRECT_URI, null);
	}

	String authorize(User user, String redirectUri, String codeVerifier) {
		String code = "code-" + UUID.randomUUID();
		grants.put(code, new Grant(user, redirectUri, codeVerifier));
		return code;
	}

	static User user(long id, String login, String name, String primaryEmail) {
		List<Map<String, Object>> emails = new ArrayList<>();
		if (primaryEmail != null) {
			emails.add(email(primaryEmail, true, true));
		}
		emails.add(email(id + "+" + login + "@users.noreply.github.com", false, true));
		return new User(id, login, name, emails);
	}

	static Map<String, Object> email(String address, boolean primary, boolean verified) {
		Map<String, Object> email = new HashMap<>();
		email.put("email", address);
		email.put("primary", primary);
		email.put("verified", verified);
		email.put("visibility", primary ? "private" : null);
		return email;
	}

	private void token(HttpExchange exchange) throws IOException {
		Map<String, String> form = parseForm(exchange.getRequestBody());
		tokenRequests.add(form);
		if (tokenStatus != 200) {
			respond(exchange, tokenStatus, Map.of("message", "Server Error"));
			return;
		}
		if (!"POST".equals(exchange.getRequestMethod()) || !CLIENT_ID.equals(form.get("client_id"))
				|| !CLIENT_SECRET.equals(form.get("client_secret"))) {
			respond(exchange, 200, Map.of("error", "incorrect_client_credentials"));
			return;
		}
		Grant grant = grants.remove(String.valueOf(form.get("code"))); // code 只能用一次
		if (grant == null || !grant.redirectUri().equals(form.get("redirect_uri"))
				|| (grant.codeVerifier() != null && !grant.codeVerifier().equals(form.get("code_verifier")))) {
			respond(exchange, 200, Map.of("error", "bad_verification_code"));
			return;
		}
		String accessToken = "gho_" + UUID.randomUUID();
		tokens.put(accessToken, grant);
		respond(exchange, 200, Map.of("access_token", accessToken, "token_type", "bearer", "scope", "user:email"));
	}

	private void user(HttpExchange exchange) throws IOException {
		String auth = exchange.getRequestHeaders().getFirst("Authorization");
		Grant grant = auth == null ? null : tokens.get(auth.replaceFirst("^Bearer ", ""));
		if (exchange.getRequestHeaders().getFirst("User-Agent") == null) {
			respond(exchange, 403, Map.of("message", "Request forbidden by administrative rules. Please make sure your request has a User-Agent header"));
			return;
		}
		boolean emails = exchange.getRequestURI().getPath().equals("/user/emails");
		int status = emails ? emailsStatus : userStatus;
		if (status != 200) {
			respond(exchange, status, Map.of("message", "error"));
			return;
		}
		if (grant == null) {
			respond(exchange, 401, Map.of("message", "Bad credentials"));
			return;
		}
		User user = grant.user();
		if (emails) {
			respond(exchange, 200, user.emails());
			return;
		}
		Map<String, Object> body = new HashMap<>();
		body.put("id", user.id());
		body.put("login", user.login());
		body.put("name", user.name());
		body.put("email", null);
		respond(exchange, 200, body);
	}

	private static Map<String, String> parseForm(InputStream body) throws IOException {
		Map<String, String> form = new HashMap<>();
		String raw = new String(body.readAllBytes(), StandardCharsets.UTF_8);
		for (String pair : raw.split("&")) {
			if (pair.isEmpty()) {
				continue;
			}
			int eq = pair.indexOf('=');
			String key = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
			String value = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
			form.put(key, value);
		}
		return form;
	}

	private static void respond(HttpExchange exchange, int status, Object body) throws IOException {
		byte[] bytes = JSON.writeValueAsBytes(body);
		exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
		exchange.sendResponseHeaders(status, bytes.length);
		try (OutputStream out = exchange.getResponseBody()) {
			out.write(bytes);
		}
	}

	record User(long id, String login, String name, List<Map<String, Object>> emails) {
	}

	private record Grant(User user, String redirectUri, String codeVerifier) {
	}
}
