package com.percyku.backend;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;

class CartApiTest extends ApiTestSupport {

	@Test
	void emptyCartMatchesHexschoolShape() throws Exception {
		mockMvc.perform(get(API + "/cart"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.carts", hasSize(0)))
				.andExpect(jsonPath("$.data.total").value(0))
				.andExpect(jsonPath("$.data.final_total").value(0))
				.andExpect(jsonPath("$.messages", hasSize(0)));
	}

	@Test
	void addReturnsProductTitleUsedByFrontendToast() throws Exception {
		String id = createProduct("東京5日遊", 1000);

		postJson(API + "/cart", data(Map.of("product_id", id, "qty", 2)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已加入購物車"))
				.andExpect(jsonPath("$.data.product_id").value(id))
				.andExpect(jsonPath("$.data.qty").value(2))
				.andExpect(jsonPath("$.data.total").value(2000))
				.andExpect(jsonPath("$.data.final_total").value(2000))
				.andExpect(jsonPath("$.data.product.title").value("東京5日遊"));
	}

	@Test
	void addingSameProductMergesIntoOneLine() throws Exception {
		String id = createProduct("東京", 1000);
		addToCart(id, 2);
		addToCart(id, 3);

		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.carts", hasSize(1)))
				.andExpect(jsonPath("$.data.carts[0].qty").value(5))
				.andExpect(jsonPath("$.data.total").value(5000));
	}

	@Test
	void updateSetsQuantityAndReturnsSwaggerShape() throws Exception {
		String productId = createProduct("東京", 1000);
		String cartId = addToCart(productId, 2);

		mockMvc.perform(put(API + "/cart/" + cartId).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("product_id", productId, "qty", 7)))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新購物車"))
				.andExpect(jsonPath("$.data.product_id").value(productId))
				.andExpect(jsonPath("$.data.qty").value(7));

		mockMvc.perform(get(API + "/cart")).andExpect(jsonPath("$.data.total").value(7000));
	}

	@Test
	void cartTotalsFollowCurrentPrice() throws Exception {
		String id = createProduct("東京", 1000);
		addToCart(id, 2);

		adminPut(API + "/admin/product/" + id, productBody("東京", "亞洲", 1500, 1));

		mockMvc.perform(get(API + "/cart")).andExpect(jsonPath("$.data.total").value(3000));
	}

	@Test
	void invalidRequestsAreRejected() throws Exception {
		String id = createProduct("東京", 1000);
		String disabledId = createProduct("下架", "亞洲", 1000, 0);
		String cartId = addToCart(id, 1);

		postJson(API + "/cart", data(Map.of("product_id", "missing", "qty", 1)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到產品"));
		postJson(API + "/cart", data(Map.of("product_id", disabledId, "qty", 1)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("產品已下架"));
		postJson(API + "/cart", data(Map.of("product_id", id, "qty", 0)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("qty 不得小於 1"));
		postJson(API + "/cart", data(Map.of("product_id", id, "qty", 9999)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("qty 不得大於 9999"));
		mockMvc.perform(put(API + "/cart/missing").contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("product_id", id, "qty", 1)))))
				.andExpect(status().isNotFound());
		mockMvc.perform(put(API + "/cart/" + cartId).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("product_id", disabledId, "qty", 1)))))
				.andExpect(status().isBadRequest());
	}

	@Test
	void deleteSingleLineAndClearAll() throws Exception {
		String first = addToCart(createProduct("東京", 1000), 1);
		addToCart(createProduct("大阪", 1000), 1);

		mockMvc.perform(delete(API + "/cart/" + first))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已刪除"));
		mockMvc.perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts", hasSize(1)));

		mockMvc.perform(delete(API + "/carts")).andExpect(status().isOk());
		mockMvc.perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts", hasSize(0)));
	}

	@Test
	void couponDiscountsCurrentCartLines() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("SAVE40", 60, farFuture(), 1)).andExpect(status().isOk());
		addToCart(createProduct("東京", 600), 6);

		postJson(API + "/coupon", data(Map.of("code", "SAVE40")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已套用優惠券:SAVE40"))
				.andExpect(jsonPath("$.data.final_total").value(2160));

		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.total").value(3600))
				.andExpect(jsonPath("$.data.final_total").value(2160))
				.andExpect(jsonPath("$.data.carts[0].coupon.code").value("SAVE40"))
				.andExpect(jsonPath("$.data.carts[0].coupon.percent").value(60));
	}

	@Test
	void itemsAddedAfterCouponAreNotDiscounted() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1));
		addToCart(createProduct("東京", 1000), 1);
		postJson(API + "/coupon", data(Map.of("code", "HALF"))).andExpect(status().isOk());

		addToCart(createProduct("大阪", 1000), 1);

		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.total").value(2000))
				.andExpect(jsonPath("$.data.final_total").value(1500));
	}

	@Test
	void finalTotalIsRounded() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("ROUND", 33, farFuture(), 1));
		addToCart(createProduct("東京", 999), 1);

		postJson(API + "/coupon", data(Map.of("code", "ROUND")))
				.andExpect(jsonPath("$.data.final_total").value(330));
	}

	@Test
	void invalidCouponsAreRejected() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("OFF", 50, farFuture(), 0));
		adminPost(API + "/admin/coupon", couponBody("OLD", 50, 1555459200L, 1));
		adminPost(API + "/admin/coupon", couponBody("GOOD", 50, farFuture(), 1));

		postJson(API + "/coupon", data(Map.of("code", "NOPE")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到優惠券"));
		postJson(API + "/coupon", data(Map.of("code", "OFF"))).andExpect(status().isNotFound());
		postJson(API + "/coupon", data(Map.of("code", "OLD")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("優惠券已過期"));
		postJson(API + "/coupon", data(Map.of("code", "GOOD")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("購物車無資料"));
	}

	@Test
	void adminCouponCrud() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("CODE", 80, 1555459200L, 1))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已建立優惠券"));
		adminPost(API + "/admin/coupon", couponBody("CODE", 70, 1555459200L, 1))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("code 已存在"));

		String id = read(adminGet(API + "/admin/coupons")
				.andExpect(jsonPath("$.coupons", hasSize(1)))
				.andExpect(jsonPath("$.coupons[0].due_date").value(1555459200L))
				.andExpect(jsonPath("$.coupons[0].is_enabled").value(1))
				.andExpect(jsonPath("$.pagination.current_page").value(1)))
				.at("/coupons/0/id").asText();

		adminPut(API + "/admin/coupon/" + id, couponBody("CODE", 70, 1555459200L, 1))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新優惠券"));
		adminPut(API + "/admin/coupon/missing", couponBody("OTHER", 70, 1555459200L, 1))
				.andExpect(status().isNotFound());
		adminPost(API + "/admin/coupon", couponBody("BAD", 101, 1555459200L, 1))
				.andExpect(status().isBadRequest());

		mockMvc.perform(auth(delete(API + "/admin/coupon/" + id)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已刪除優惠券"));
		mockMvc.perform(auth(delete(API + "/admin/coupon/" + id)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到優惠券"));
	}

	@Test
	void deletingCouponRemovesDiscountFromCart() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1));
		addToCart(createProduct("東京", 1000), 1);
		postJson(API + "/coupon", data(Map.of("code", "HALF")));
		String couponId = couponRepository.findByCode("HALF").orElseThrow().getId();

		mockMvc.perform(auth(delete(API + "/admin/coupon/" + couponId))).andExpect(status().isOk());

		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.final_total").value(1000))
				.andExpect(jsonPath("$.data.carts[0].coupon").doesNotExist());
	}

	private String couponId(String code) throws Exception {
		for (JsonNode coupon : read(adminGet(API + "/admin/coupons")).get("coupons")) {
			if (coupon.get("code").asText().equals(code)) {
				return coupon.get("id").asText();
			}
		}
		throw new AssertionError("找不到優惠券: " + code);
	}

	@Test
	void disabledOrExpiredCouponStopsDiscountImmediately() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		addToCart(createProduct("東京", 1000), 1);
		postJson(API + "/coupon", data(Map.of("code", "HALF"))).andExpect(status().isOk());
		String id = couponId("HALF");

		// 停用：購物車立即不再折扣，品項也不出現 coupon
		adminPut(API + "/admin/coupon/" + id, couponBody("HALF", 50, farFuture(), 0)).andExpect(status().isOk());
		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.total").value(1000))
				.andExpect(jsonPath("$.data.final_total").value(1000))
				.andExpect(jsonPath("$.data.carts[0].coupon").doesNotExist());

		// 重新啟用：引用還在，折扣恢復
		adminPut(API + "/admin/coupon/" + id, couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.final_total").value(500))
				.andExpect(jsonPath("$.data.carts[0].coupon.code").value("HALF"));

		// 過期：同樣立即不再折扣
		adminPut(API + "/admin/coupon/" + id, couponBody("HALF", 50, 1555459200L, 1)).andExpect(status().isOk());
		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.final_total").value(1000))
				.andExpect(jsonPath("$.data.carts[0].coupon").doesNotExist());
	}

	@Test
	void removeCouponRestoresPriceAndIsIdempotent() throws Exception {
		adminPost(API + "/admin/coupon", couponBody("HALF", 50, farFuture(), 1)).andExpect(status().isOk());
		addToCart(createProduct("東京", 1000), 2);
		postJson(API + "/coupon", data(Map.of("code", "HALF")))
				.andExpect(jsonPath("$.data.final_total").value(1000));

		mockMvc.perform(delete(API + "/coupon"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.message").value("已移除優惠券"))
				.andExpect(jsonPath("$.data.final_total").value(2000));
		mockMvc.perform(get(API + "/cart"))
				.andExpect(jsonPath("$.data.final_total").value(2000))
				.andExpect(jsonPath("$.data.carts[0].coupon").doesNotExist());

		// 沒有套用、購物車是空的，都視為成功
		mockMvc.perform(delete(API + "/coupon"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.final_total").value(2000));
		cartItemRepository.deleteAll();
		mockMvc.perform(delete(API + "/coupon"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.final_total").value(0));
	}
}
