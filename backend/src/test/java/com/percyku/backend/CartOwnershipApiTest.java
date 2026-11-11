package com.percyku.backend;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 每個訪客與會員各一台購物車，以及登入後的合併。預設的訪客是 GuestCartTestConfig 的 X-Cart-Id。 */
class CartOwnershipApiTest extends ApiTestSupport {

	private static final String OTHER_GUEST = "1c6f0a52-8e1b-4d9a-b7f3-5a2e9c4d0b18";

	private ResultActions perform(MockHttpServletRequestBuilder request) throws Exception {
		return mockMvc.perform(request);
	}

	private ResultActions add(MockHttpServletRequestBuilder post, String productId, int qty) throws Exception {
		return mockMvc.perform(post.contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("product_id", productId, "qty", qty)))));
	}

	private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder request, String memberToken) {
		return request.header("Authorization", memberToken);
	}

	private static MockHttpServletRequestBuilder withoutCartId(MockHttpServletRequestBuilder request) {
		// 覆寫預設的 X-Cart-Id 為空白，等同沒帶
		return request.header("X-Cart-Id", "");
	}

	@Test
	void eachGuestHasOwnCart() throws Exception {
		String tokyo = createProduct("東京", 1000);
		addToCart(tokyo, 2);
		add(asGuest(post(API + "/cart"), OTHER_GUEST), tokyo, 5).andExpect(status().isOk());

		perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts[0].qty").value(2));
		perform(asGuest(get(API + "/cart"), OTHER_GUEST)).andExpect(jsonPath("$.data.carts[0].qty").value(5));
	}

	@Test
	void memberCartIsSeparateAndIgnoresCartIdHeader() throws Exception {
		String memberToken = signupMember("traveler@example.com", "王小明");
		String tokyo = createProduct("東京", 1000);
		addToCart(tokyo, 2);

		// 帶 token 時忽略 X-Cart-Id，即使格式錯誤
		perform(withToken(asGuest(get(API + "/cart"), "not-a-uuid"), memberToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.carts", hasSize(0)));
		add(withToken(post(API + "/cart"), memberToken), tokyo, 1).andExpect(status().isOk());

		perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts[0].qty").value(2));
		perform(withToken(get(API + "/cart"), memberToken)).andExpect(jsonPath("$.data.carts[0].qty").value(1));
	}

	@Test
	void withoutCartIdOnlyAddingFails() throws Exception {
		String tokyo = createProduct("東京", 1000);

		perform(withoutCartId(get(API + "/cart")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.carts", hasSize(0)))
				.andExpect(jsonPath("$.data.final_total").value(0));
		add(withoutCartId(post(API + "/cart")), tokyo, 1)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("缺少 X-Cart-Id"));
		perform(withoutCartId(delete(API + "/carts"))).andExpect(status().isOk());
		perform(withoutCartId(delete(API + "/coupon")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.final_total").value(0));
	}

	@Test
	void invalidCartIdIsRejected() throws Exception {
		String tokyo = createProduct("東京", 1000);

		for (String invalid : new String[] { "not-a-uuid", "1-1-1-1-1", "9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d" }) {
			perform(asGuest(get(API + "/cart"), invalid))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.success").value(false))
					.andExpect(jsonPath("$.message").value("X-Cart-Id 格式不正確"));
			add(asGuest(post(API + "/cart"), invalid), tokyo, 1)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("X-Cart-Id 格式不正確"));
		}
		// 大寫視為同一個 id
		addToCart(tokyo, 1);
		perform(asGuest(get(API + "/cart"), GuestCartTestConfig.GUEST_CART_ID.toUpperCase()))
				.andExpect(jsonPath("$.data.carts", hasSize(1)));
	}

	@Test
	void cannotTouchAnotherCartsLine() throws Exception {
		String tokyo = createProduct("東京", 1000);
		String lineId = addToCart(tokyo, 2);

		mockMvc.perform(asGuest(put(API + "/cart/" + lineId), OTHER_GUEST).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("product_id", tokyo, "qty", 9)))))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到購物車品項"));
		perform(asGuest(delete(API + "/cart/" + lineId), OTHER_GUEST))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到購物車品項"));
		perform(asGuest(delete(API + "/carts"), OTHER_GUEST)).andExpect(status().isOk());

		perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts[0].qty").value(2));
	}

	@Test
	void couponAppliesOnlyToCallersCart() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		String tokyo = createProduct("東京", 1000);
		addToCart(tokyo, 1);
		add(asGuest(post(API + "/cart"), OTHER_GUEST), tokyo, 1).andExpect(status().isOk());

		postJson(API + "/coupon", data(Map.of("code", "HALF"))).andExpect(status().isOk());

		perform(get(API + "/cart")).andExpect(jsonPath("$.data.final_total").value(500));
		perform(asGuest(get(API + "/cart"), OTHER_GUEST)).andExpect(jsonPath("$.data.final_total").value(1000));
		mockMvc.perform(asGuest(post(API + "/coupon"), "1c6f0a52-0000-4d9a-b7f3-5a2e9c4d0b18")
				.contentType(MediaType.APPLICATION_JSON).content(json(data(Map.of("code", "HALF")))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("購物車無資料"));
	}

	@Test
	void deletingProductRemovesItFromEveryCart() throws Exception {
		String tokyo = createProduct("東京", 1000);
		addToCart(tokyo, 1);
		add(asGuest(post(API + "/cart"), OTHER_GUEST), tokyo, 1).andExpect(status().isOk());

		mockMvc.perform(auth(delete(API + "/admin/product/" + tokyo))).andExpect(status().isOk());

		perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts", hasSize(0)));
		perform(asGuest(get(API + "/cart"), OTHER_GUEST)).andExpect(jsonPath("$.data.carts", hasSize(0)));
	}

	// ───────────── 合併 ─────────────

	@Test
	void mergeMovesGuestLinesAndSumsSameProduct() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		adminPost(API + "/admin/coupon", couponBody("OFF20", 80, farFuture(), 1)).andExpect(status().isOk());
		String memberToken = signupMember("traveler@example.com", "王小明");
		String tokyo = createProduct("東京", 1000);
		String osaka = createProduct("大阪", 2000);
		String seoul = createProduct("首爾", 100);

		// 會員：東京 1，套用 OFF20
		add(withToken(post(API + "/cart"), memberToken), tokyo, 1).andExpect(status().isOk());
		mockMvc.perform(withToken(post(API + "/coupon"), memberToken).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("code", "OFF20"))))).andExpect(status().isOk());
		// 訪客：東京 2、大阪 1，套用 HALF；首爾 9999 之後再加
		addToCart(tokyo, 2);
		addToCart(osaka, 1);
		postJson(API + "/coupon", data(Map.of("code", "HALF"))).andExpect(status().isOk());

		perform(withToken(post(API + "/cart/merge"), memberToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.messages", hasSize(0)))
				.andExpect(jsonPath("$.data.carts", hasSize(2)))
				// 同一產品：數量相加，優惠以會員原本的 OFF20 為準
				.andExpect(jsonPath("$.data.carts[0].product.title").value("東京"))
				.andExpect(jsonPath("$.data.carts[0].qty").value(3))
				.andExpect(jsonPath("$.data.carts[0].coupon.code").value("OFF20"))
				.andExpect(jsonPath("$.data.carts[0].final_total").value(2400))
				// 移過去的品項保留訪客套用的 HALF
				.andExpect(jsonPath("$.data.carts[1].product.title").value("大阪"))
				.andExpect(jsonPath("$.data.carts[1].coupon.code").value("HALF"))
				.andExpect(jsonPath("$.data.carts[1].final_total").value(1000));

		// 訪客購物車已刪除
		perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts", hasSize(0)));
		// 重複呼叫不會重複合併
		perform(withToken(post(API + "/cart/merge"), memberToken))
				.andExpect(jsonPath("$.data.carts[0].qty").value(3));

		// 數量相加超過上限時以 9999 計
		addToCart(seoul, 9999);
		add(withToken(post(API + "/cart"), memberToken), seoul, 5).andExpect(status().isOk());
		perform(withToken(post(API + "/cart/merge"), memberToken))
				.andExpect(jsonPath("$.data.carts[2].product.title").value("首爾"))
				.andExpect(jsonPath("$.data.carts[2].qty").value(9999));
	}

	@Test
	void mergeIntoMemberWithoutCartCreatesIt() throws Exception {
		String memberToken = signupMember("traveler@example.com", "王小明");
		addToCart(createProduct("東京", 1000), 2);

		perform(withToken(post(API + "/cart/merge"), memberToken))
				.andExpect(jsonPath("$.data.carts", hasSize(1)))
				.andExpect(jsonPath("$.data.total").value(2000));
		perform(withToken(get(API + "/cart"), memberToken)).andExpect(jsonPath("$.data.carts", hasSize(1)));
	}

	@Test
	void mergeWithoutGuestCartReturnsMemberCart() throws Exception {
		String memberToken = signupMember("traveler@example.com", "王小明");
		add(withToken(post(API + "/cart"), memberToken), createProduct("東京", 1000), 1).andExpect(status().isOk());

		perform(withoutCartId(withToken(post(API + "/cart/merge"), memberToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.carts", hasSize(1)));
		perform(asGuest(withToken(post(API + "/cart/merge"), memberToken), OTHER_GUEST))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.carts", hasSize(1)));
	}

	@Test
	void mergeRequiresTokenAndValidCartId() throws Exception {
		perform(post(API + "/cart/merge"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("驗證錯誤, 請重新登入"));

		String memberToken = signupMember("traveler@example.com", "王小明");
		perform(asGuest(withToken(post(API + "/cart/merge"), memberToken), "not-a-uuid"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("X-Cart-Id 格式不正確"));
	}

	@Test
	void mergedCartCanBeCheckedOut() throws Exception {
		shopperToken = signupMember("traveler@example.com", "王小明");
		String tokyo = createProduct("東京", 1000);
		// 以訪客身分加入購物車，登入後合併再結帳
		postJson(API + "/cart", data(Map.of("product_id", tokyo, "qty", 2))).andExpect(status().isOk());
		perform(withToken(post(API + "/cart/merge"), shopperToken)).andExpect(status().isOk());

		checkout();

		perform(withToken(get(API + "/cart"), shopperToken)).andExpect(jsonPath("$.data.carts", hasSize(0)));
	}
}
