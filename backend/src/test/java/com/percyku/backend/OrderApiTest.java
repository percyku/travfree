package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.JsonNode;

class OrderApiTest extends ApiTestSupport {

	private static final String SHOPPER_EMAIL = "shopper@example.com";

	@Autowired
	JdbcTemplate jdbc;

	/** 結帳需要會員，購物與結帳都以這個會員進行 */
	@BeforeEach
	void signInShopper() throws Exception {
		shopperToken = signupMember(SHOPPER_EMAIL, "買家");
	}

	@Test
	void checkoutRequiresMemberWithUserRole() throws Exception {
		addToCart(createProduct("東京", 1000), 1);

		mockMvc.perform(post(API + "/order").contentType("application/json").content(json(orderBody())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("驗證錯誤, 請重新登入"));
		// 預設 admin 只有 ADMIN，不能結帳
		adminPost(API + "/order", orderBody())
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("無此權限"));

		mockMvc.perform(asShopper(get(API + "/cart"))).andExpect(jsonPath("$.data.carts", hasSize(1)));
	}

	@Test
	void orderRecordsBuyerAccountNotFormEmail() throws Exception {
		addToCart(createProduct("東京", 1000), 1);
		String orderId = checkout();

		String buyerId = jdbc.queryForObject("SELECT user_id FROM orders WHERE id = ?", String.class, orderId);
		String shopperId = userRepository.findByEmail(SHOPPER_EMAIL).orElseThrow().getId();
		assertThat(buyerId).isEqualTo(shopperId);
		// 收件資料照表單保存，與帳號無關
		mockMvc.perform(get(API + "/order/" + orderId))
				.andExpect(jsonPath("$.order.user.email").value("buyer@example.com"));
	}

	@Test
	void checkoutClearsOnlyTheMembersCart() throws Exception {
		String productId = createProduct("東京", 1000);
		addToCart(productId, 1);
		// 同一個瀏覽器的訪客購物車（預設的 X-Cart-Id）不受影響
		postJson(API + "/cart", data(Map.of("product_id", productId, "qty", 3))).andExpect(status().isOk());

		checkout();

		mockMvc.perform(asShopper(get(API + "/cart"))).andExpect(jsonPath("$.data.carts", hasSize(0)));
		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.carts", hasSize(1)))
				.andExpect(jsonPath("$.data.carts[0].qty").value(3));
	}

	@Test
	void checkoutCreatesOrderAndClearsCart() throws Exception {
		addToCart(createProduct("東京", 1000), 2);

		JsonNode body = read(shopperPost(API + "/order", orderBody())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.message").value("已建立訂單"))
				.andExpect(jsonPath("$.total").value(2000))
				.andExpect(jsonPath("$.orderId").isNotEmpty()));

		// 訂單時間是秒，不是毫秒
		long now = Instant.now().getEpochSecond();
		assertThat(body.get("create_at").asLong()).isBetween(now - 60, now + 60);
		mockMvc.perform(asShopper(get(API + "/cart"))).andExpect(jsonPath("$.data.carts", hasSize(0)));
	}

	@Test
	void orderDetailMatchesWhatCartSuccessReads() throws Exception {
		String productId = createProduct("東京", 1000);
		addToCart(productId, 2);
		String orderId = checkout();

		JsonNode order = read(mockMvc.perform(get(API + "/order/" + orderId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.order.id").value(orderId))
				.andExpect(jsonPath("$.order.total").value(2000))
				.andExpect(jsonPath("$.order.is_paid").value(false))
				.andExpect(jsonPath("$.order.paid_date").doesNotExist())
				.andExpect(jsonPath("$.order.status").value(0))
				.andExpect(jsonPath("$.order.message").value("請小心輕放"))
				.andExpect(jsonPath("$.order.user.name").value("測試者"))
				.andExpect(jsonPath("$.order.user.email").value("buyer@example.com"))
				.andExpect(jsonPath("$.order.user.tel").value("0912345678"))
				.andExpect(jsonPath("$.order.user.address").value("高雄市")))
				.get("order");

		// products 是以品項 id 為 key 的物件，前端用 Object.values 讀取
		assertThat(order.get("products").isObject()).isTrue();
		JsonNode item = order.get("products").elements().next();
		assertThat(order.get("products").fieldNames().next()).isEqualTo(item.get("id").asText());
		assertThat(item.get("product_id").asText()).isEqualTo(productId);
		assertThat(item.get("qty").asInt()).isEqualTo(2);
		assertThat(item.get("final_total").asLong()).isEqualTo(2000);
		assertThat(item.at("/product/title").asText()).isEqualTo("東京");
		assertThat(item.at("/product/price").asInt()).isEqualTo(1000);
	}

	@Test
	void unknownOrderReturns200WithNull() throws Exception {
		mockMvc.perform(get(API + "/order/missing"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.order").value((Object) null));
	}

	@Test
	void orderKeepsSnapshotAfterProductChangesOrIsDeleted() throws Exception {
		String productId = createProduct("原名稱", 1000);
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1));
		addToCart(productId, 2);
		shopperPost(API + "/coupon", data(Map.of("code", "HALF")));
		String orderId = checkout();

		adminPut(API + "/admin/product/" + productId, productBody("新名稱", "亞洲", 9999, 1));
		JsonNode item = read(mockMvc.perform(get(API + "/order/" + orderId)))
				.at("/order/products").elements().next();
		assertThat(item.at("/product/title").asText()).isEqualTo("原名稱");
		assertThat(item.at("/product/price").asInt()).isEqualTo(1000);
		assertThat(item.get("final_total").asLong()).isEqualTo(1000);
		assertThat(item.at("/coupon/code").asText()).isEqualTo("HALF");

		mockMvc.perform(auth(delete(API + "/admin/product/" + productId))).andExpect(status().isOk());
		couponRepository.deleteAll();
		mockMvc.perform(get(API + "/order/" + orderId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.order.total").value(1000));
	}

	@Test
	void checkoutValidation() throws Exception {
		shopperPost(API + "/order", orderBody())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("購物車無資料"));

		String productId = createProduct("東京", 1000);
		addToCart(productId, 1);
		shopperPost(API + "/order", data(Map.of("message", "沒有收件資料")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("user 屬性不得為空"));
		shopperPost(API + "/order", data(Map.of("user", Map.of("name", "x", "email", "not-mail", "tel", "1", "address", "a"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("email 格式不正確"));

		adminPut(API + "/admin/product/" + productId, productBody("東京", "亞洲", 1000, 0));
		shopperPost(API + "/order", orderBody())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("購物車內有已下架產品"));
	}

	@Test
	void payMarksOrderPaidOnce() throws Exception {
		addToCart(createProduct("東京", 1000), 1);
		String orderId = checkout();

		mockMvc.perform(post(API + "/pay/" + orderId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("付款完成"));

		JsonNode order = read(mockMvc.perform(get(API + "/order/" + orderId))).get("order");
		assertThat(order.get("is_paid").asBoolean()).isTrue();
		long now = Instant.now().getEpochSecond();
		assertThat(order.get("paid_date").asLong()).isBetween(now - 60, now + 60);

		mockMvc.perform(post(API + "/pay/" + orderId))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("訂單已付款"));
		mockMvc.perform(post(API + "/pay/missing"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到訂單"));
	}

	@Test
	void adminUpdateAcceptsWholeOrderFromFrontendButOnlyChangesPaymentAndStatus() throws Exception {
		addToCart(createProduct("東京", 1000), 1);
		String orderId = checkout();
		JsonNode order = read(adminGet(API + "/admin/orders")).at("/orders/0");

		// 與 AdminOrders.jsx 相同：整筆訂單傳回，status 是 select 給的字串
		@SuppressWarnings("unchecked")
		Map<String, Object> body = new HashMap<>(objectMapper.convertValue(order, Map.class));
		body.put("is_paid", true);
		body.put("status", "2");
		body.put("total", 1);
		adminPut(API + "/admin/order/" + orderId, data(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新訂單資訊"));

		JsonNode updated = read(adminGet(API + "/admin/orders")).at("/orders/0");
		assertThat(updated.get("is_paid").asBoolean()).isTrue();
		assertThat(updated.get("status").asInt()).isEqualTo(2);
		assertThat(updated.get("paid_date").isNumber()).isTrue();
		assertThat(updated.get("total").asLong()).isEqualTo(1000);

		adminPut(API + "/admin/order/" + orderId, data(Map.of("is_paid", false, "status", 0)));
		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders[0].paid_date").doesNotExist());
	}

	@Test
	void adminUpdateRejectsUnknownStatusAndOrder() throws Exception {
		addToCart(createProduct("東京", 1000), 1);
		String orderId = checkout();

		adminPut(API + "/admin/order/" + orderId, data(Map.of("status", 9)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("status 必須介於 0 到 3"));
		adminPut(API + "/admin/order/missing", data(Map.of("status", 1)))
				.andExpect(status().isNotFound());
	}

	@Test
	void adminListIsPagedAndDeleteWorks() throws Exception {
		addToCart(createProduct("東京", 1000), 1);
		String first = checkout();
		addToCart(createProduct("大阪", 1000), 1);
		checkout();

		adminGet(API + "/admin/orders?page=1")
				.andExpect(jsonPath("$.orders", hasSize(2)))
				.andExpect(jsonPath("$.orders[0].num").value(1))
				.andExpect(jsonPath("$.pagination.total_pages").value(1))
				.andExpect(jsonPath("$.messages", hasSize(0)));

		mockMvc.perform(auth(delete(API + "/admin/order/" + first)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已刪除"));
		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders", hasSize(1)));

		mockMvc.perform(auth(delete(API + "/admin/orders/all"))).andExpect(status().isOk());
		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders", hasSize(0)));
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> orderBodyWithTotal(long finalTotal) {
		Map<String, Object> order = new HashMap<>((Map<String, Object>) orderBody().get("data"));
		order.put("final_total", finalTotal);
		return data(order);
	}

	@Test
	void checkoutRejectsWhenFinalTotalDiffers() throws Exception {
		addToCart(createProduct("東京", 1000), 2);

		shopperPost(API + "/order", orderBodyWithTotal(1500))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("訂單金額已變動，請重新確認"));
		// 不建立訂單，購物車保留
		assertThat(orderRepository.count()).isZero();
		mockMvc.perform(asShopper(get(API + "/cart"))).andExpect(jsonPath("$.data.carts", hasSize(1)));

		shopperPost(API + "/order", orderBodyWithTotal(2000))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(2000));
	}

	@Test
	void couponDeletedAfterApplyingIsCaughtByFinalTotal() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		addToCart(createProduct("東京", 1000), 1);
		shopperPost(API + "/coupon", data(Map.of("code", "HALF")))
				.andExpect(jsonPath("$.data.final_total").value(500));
		String couponId = read(adminGet(API + "/admin/coupons")).at("/coupons/0/id").asText();
		mockMvc.perform(auth(delete(API + "/admin/coupon/" + couponId))).andExpect(status().isOk());

		// 前端畫面還是折扣後的 500
		shopperPost(API + "/order", orderBodyWithTotal(500)).andExpect(status().isConflict());
		// 重新讀取購物車後，以新金額送出
		shopperPost(API + "/order", orderBodyWithTotal(1000))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1000));
	}

	@Test
	void disabledCouponIsNotDiscountedAtCheckout() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		addToCart(createProduct("東京", 1000), 1);
		shopperPost(API + "/coupon", data(Map.of("code", "HALF"))).andExpect(status().isOk());
		String couponId = read(adminGet(API + "/admin/coupons")).at("/coupons/0/id").asText();
		adminPut(API + "/admin/coupon/" + couponId, couponBody("HALF", 50, farFuture(), 0))
				.andExpect(status().isOk());

		String orderId = read(shopperPost(API + "/order", orderBody())
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1000))).get("orderId").asText();
		JsonNode products = read(mockMvc.perform(get(API + "/order/" + orderId))).at("/order/products");
		products.forEach(item -> assertThat(item.has("coupon")).isFalse());
	}
}
