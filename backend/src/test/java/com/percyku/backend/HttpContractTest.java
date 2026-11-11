package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** 走真實 Tomcat，驗證 MockMvc 碰不到的部分：/v2 前綴、CORS、multipart 上限與錯誤格式。 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class HttpContractTest {

	private static final String FRONTEND_ORIGIN = "http://localhost:5173";

	@LocalServerPort
	int port;

	private final HttpClient client = HttpClient.newHttpClient();
	private final ObjectMapper objectMapper = new ObjectMapper();

	private URI uri(String path) {
		return URI.create("http://localhost:" + port + "/v2" + path);
	}

	private String signin() throws Exception {
		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/admin/signin"))
				.header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString("{\"username\":\"admin@gmail.com\",\"password\":\"Test123456\"}"))
				.build(), HttpResponse.BodyHandlers.ofString());
		return objectMapper.readTree(response.body()).get("token").asText();
	}

	@Test
	void servesApiUnderV2Prefix() throws Exception {
		HttpResponse<String> response = client.send(
				HttpRequest.newBuilder(uri("/api/products")).GET().build(),
				HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(objectMapper.readTree(response.body()).get("success").asBoolean()).isTrue();
	}

	@Test
	void preflightAllowsFrontendOriginToSendAuthorizationHeader() throws Exception {
		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/user/check"))
				.method("OPTIONS", HttpRequest.BodyPublishers.noBody())
				.header("Origin", FRONTEND_ORIGIN)
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "authorization")
				.build(), HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(FRONTEND_ORIGIN);
		assertThat(response.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase())
				.contains("authorization");
	}

	/** 開發模式前端（:5173）與後端不同源，購物車請求帶的 X-Cart-Id 要通過預檢。 */
	@Test
	void preflightAllowsCartIdHeader() throws Exception {
		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/cart"))
				.method("OPTIONS", HttpRequest.BodyPublishers.noBody())
				.header("Origin", FRONTEND_ORIGIN)
				.header("Access-Control-Request-Method", "POST")
				.header("Access-Control-Request-Headers", "content-type,x-cart-id")
				.build(), HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(200);
		assertThat(response.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase())
				.contains("x-cart-id");
	}

	@Test
	void unauthorizedResponseCarriesCorsHeadersSoFrontendCanReadIt() throws Exception {
		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/user/check"))
				.header("Origin", FRONTEND_ORIGIN)
				.POST(HttpRequest.BodyPublishers.noBody())
				.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

		assertThat(response.statusCode()).isEqualTo(401);
		assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).contains(FRONTEND_ORIGIN);
		assertThat(objectMapper.readTree(response.body()).get("message").asText()).isEqualTo("驗證錯誤, 請重新登入");
	}

	@Test
	void otherOriginsAreNotAllowed() throws Exception {
		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/user/check"))
				.method("OPTIONS", HttpRequest.BodyPublishers.noBody())
				.header("Origin", "https://evil.example")
				.header("Access-Control-Request-Method", "POST")
				.build(), HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(403);
	}

	@Test
	void unknownRoutesReturnJsonErrors() throws Exception {
		// 舊的 Hexschool 路徑（含 api_path）已移除，不保留相容
		HttpResponse<String> unknownPath = client.send(
				HttpRequest.newBuilder(uri("/api/react-week2-api/products")).GET().build(),
				HttpResponse.BodyHandlers.ofString());
		assertThat(unknownPath.statusCode()).isEqualTo(404);
		assertThat(objectMapper.readTree(unknownPath.body()).get("success").asBoolean()).isFalse();

		HttpResponse<String> wrongMethod = client.send(HttpRequest.newBuilder(uri("/api/products"))
				.DELETE().build(), HttpResponse.BodyHandlers.ofString());
		assertThat(wrongMethod.statusCode()).isEqualTo(405);
		assertThat(objectMapper.readTree(wrongMethod.body()).get("success").asBoolean()).isFalse();
	}

	@Test
	void uploadOverLimitReturnsJsonErrorInsteadOfDroppingConnection() throws Exception {
		String boundary = "travfree-test-boundary";
		byte[] head = ("--" + boundary + "\r\n"
				+ "Content-Disposition: form-data; name=\"file-to-upload\"; filename=\"large.png\"\r\n"
				+ "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8);
		byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
		List<byte[]> body = new ArrayList<>(List.of(head, new byte[5 * 1024 * 1024], tail));

		HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri("/api/admin/upload"))
				.header("Authorization", signin())
				.header("Content-Type", "multipart/form-data; boundary=" + boundary)
				.POST(HttpRequest.BodyPublishers.ofByteArrays(body))
				.build(), HttpResponse.BodyHandlers.ofString());

		assertThat(response.statusCode()).isEqualTo(400);
		JsonNode json = objectMapper.readTree(response.body());
		assertThat(json.get("success").asBoolean()).isFalse();
		assertThat(json.get("message").asText()).isEqualTo("檔案大小不得超過 3MB");
	}
}
