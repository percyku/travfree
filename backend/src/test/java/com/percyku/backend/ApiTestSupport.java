package com.percyku.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.percyku.backend.repository.ArticleRepository;
import com.percyku.backend.repository.CartItemRepository;
import com.percyku.backend.repository.CouponRepository;
import com.percyku.backend.repository.OrderRepository;
import com.percyku.backend.repository.ProductRepository;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.LoginAttemptLimiter;

/** 走真實的 JWT 流程：先用預設 admin 登入，再以前端相同的裸 token 呼叫 API。 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(OpenApiContractConfig.class)
abstract class ApiTestSupport {

	static final String API = "/api";
	static final String ADMIN_EMAIL = "admin@gmail.com";
	static final String MEMBER_PASSWORD = "Travel2026";

	@Autowired
	MockMvc mockMvc;

	@Autowired
	ObjectMapper objectMapper;

	@Autowired
	CartItemRepository cartItemRepository;

	@Autowired
	OrderRepository orderRepository;

	@Autowired
	ProductRepository productRepository;

	@Autowired
	CouponRepository couponRepository;

	@Autowired
	ArticleRepository articleRepository;

	@Autowired
	UserRepository userRepository;

	@Autowired
	LoginAttemptLimiter loginAttemptLimiter;

	String token;

	@BeforeEach
	void resetData() throws Exception {
		cartItemRepository.deleteAll();
		orderRepository.deleteAll();
		productRepository.deleteAll();
		couponRepository.deleteAll();
		articleRepository.deleteAll();
		// 只留下預設 admin，測試註冊的會員不跨測試保留
		userRepository.deleteAll(userRepository.findAll().stream()
				.filter(user -> !user.getEmail().equals(ADMIN_EMAIL)).toList());
		// 所有 MockMvc 請求都來自 127.0.0.1，不清空的話登入失敗會跨測試累計
		loginAttemptLimiter.reset();
		token = signin();
	}

	String signin() throws Exception {
		return read(postJson("/admin/signin", Map.of("username", "admin@gmail.com", "password", "Test123456"))
				.andExpect(status().isOk())).get("token").asText();
	}

	/** 註冊一般會員，回傳 token */
	String signupMember(String email, String name) throws Exception {
		return read(postJson(API + "/user/signup",
				data(Map.of("email", email, "password", MEMBER_PASSWORD, "name", name)))
				.andExpect(status().isOk())).get("token").asText();
	}

	ResultActions postJson(String path, Object body) throws Exception {
		return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json(body)));
	}

	ResultActions adminGet(String path) throws Exception {
		return mockMvc.perform(auth(get(path)));
	}

	ResultActions adminPost(String path, Object body) throws Exception {
		return mockMvc.perform(auth(post(path)).contentType(MediaType.APPLICATION_JSON).content(json(body)));
	}

	ResultActions adminPut(String path, Object body) throws Exception {
		return mockMvc.perform(auth(put(path)).contentType(MediaType.APPLICATION_JSON).content(json(body)));
	}

	MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
		return request.header("Authorization", token);
	}

	JsonNode read(ResultActions actions) throws Exception {
		return objectMapper.readTree(actions.andReturn().getResponse().getContentAsByteArray());
	}

	String json(Object body) throws Exception {
		return objectMapper.writeValueAsString(body);
	}

	static Map<String, Object> data(Object value) {
		return Map.of("data", value);
	}

	/** 與前端 AdminProducts 送出的內容相同，包含後端應忽略的 id。 */
	static Map<String, Object> productBody(String title, String category, int price, int enabled) {
		Map<String, Object> product = new HashMap<>();
		product.put("id", "");
		product.put("title", title);
		product.put("category", category);
		product.put("unit", "台幣");
		product.put("origin_price", price + 1000);
		product.put("price", price);
		product.put("description", "描述");
		product.put("content", "內容");
		product.put("is_enabled", enabled);
		product.put("imageUrl", "https://example.com/main.jpg");
		product.put("imagesUrl", List.of("https://example.com/1.jpg"));
		return data(product);
	}

	String createProduct(String title, int price) throws Exception {
		return createProduct(title, "亞洲", price, 1);
	}

	String createProduct(String title, String category, int price, int enabled) throws Exception {
		adminPost(API + "/admin/product", productBody(title, category, price, enabled)).andExpect(status().isOk());
		JsonNode products = read(adminGet(API + "/admin/products/all")).get("products");
		for (JsonNode product : products) {
			if (product.get("title").asText().equals(title)) {
				return product.get("id").asText();
			}
		}
		throw new AssertionError("找不到剛建立的產品: " + title);
	}

	static Map<String, Object> couponBody(String code, int percent, long dueDate, int enabled) {
		return data(Map.of("title", "優惠", "code", code, "percent", percent, "due_date", dueDate,
				"is_enabled", enabled));
	}

	static long farFuture() {
		return java.time.Instant.now().getEpochSecond() + 86400;
	}

	String addToCart(String productId, int qty) throws Exception {
		return read(postJson(API + "/cart", data(Map.of("product_id", productId, "qty", qty)))
				.andExpect(status().isOk())).at("/data/id").asText();
	}

	static Map<String, Object> orderBody() {
		Map<String, String> user = Map.of("name", "測試者", "email", "buyer@example.com", "tel", "0912345678",
				"address", "高雄市", "message", "表單多帶的欄位");
		return data(Map.of("user", user, "message", "請小心輕放"));
	}

	String checkout() throws Exception {
		return read(postJson(API + "/order", orderBody()).andExpect(status().isOk())).get("orderId").asText();
	}
}
