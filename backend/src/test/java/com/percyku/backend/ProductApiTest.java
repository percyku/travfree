package com.percyku.backend;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ProductApiTest extends ApiTestSupport {

	@Test
	void createdProductIsVisibleOnFrontWithHexschoolFieldNames() throws Exception {
		String id = createProduct("東京5日遊", 30000);

		mockMvc.perform(get(API + "/product/" + id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.product.id").value(id))
				.andExpect(jsonPath("$.product.title").value("東京5日遊"))
				.andExpect(jsonPath("$.product.origin_price").value(31000))
				.andExpect(jsonPath("$.product.price").value(30000))
				.andExpect(jsonPath("$.product.is_enabled").value(1))
				.andExpect(jsonPath("$.product.imageUrl").value("https://example.com/main.jpg"))
				.andExpect(jsonPath("$.product.imagesUrl[0]").value("https://example.com/1.jpg"));
	}

	@Test
	void disabledProductIsHiddenFromFrontButVisibleToAdmin() throws Exception {
		String id = createProduct("未上架", "亞洲", 100, 0);

		mockMvc.perform(get(API + "/products")).andExpect(jsonPath("$.products", hasSize(0)));
		mockMvc.perform(get(API + "/products/all")).andExpect(jsonPath("$.products", hasSize(0)));
		mockMvc.perform(get(API + "/product/" + id))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到產品"));
		adminGet(API + "/admin/products").andExpect(jsonPath("$.products", hasSize(1)));
	}

	@Test
	void updateChangesWhatFrontSees() throws Exception {
		String id = createProduct("舊名稱", 100);

		adminPut(API + "/admin/product/" + id, productBody("新名稱", "歐洲", 200, 0))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新產品"));

		mockMvc.perform(get(API + "/product/" + id)).andExpect(status().isNotFound());
		adminPut(API + "/admin/product/" + id, productBody("新名稱", "歐洲", 200, 1));
		mockMvc.perform(get(API + "/product/" + id)).andExpect(jsonPath("$.product.price").value(200));
	}

	@Test
	void paginationMatchesHexschool() throws Exception {
		for (int i = 1; i <= 12; i++) {
			createProduct("產品" + i, 100);
		}

		mockMvc.perform(get(API + "/products?page=1"))
				.andExpect(jsonPath("$.products", hasSize(10)))
				.andExpect(jsonPath("$.products[0].title").value("產品12"))
				.andExpect(jsonPath("$.products[0].num").value(1))
				.andExpect(jsonPath("$.pagination.total_pages").value(2))
				.andExpect(jsonPath("$.pagination.current_page").value(1))
				.andExpect(jsonPath("$.pagination.has_pre").value(false))
				.andExpect(jsonPath("$.pagination.has_next").value(true))
				.andExpect(jsonPath("$.pagination.category").value(""));

		// 超過末頁時回傳最後一頁，num 延續名次
		mockMvc.perform(get(API + "/products?page=99"))
				.andExpect(jsonPath("$.products", hasSize(2)))
				.andExpect(jsonPath("$.products[0].num").value(11))
				.andExpect(jsonPath("$.pagination.current_page").value(2))
				.andExpect(jsonPath("$.pagination.has_pre").value(true))
				.andExpect(jsonPath("$.pagination.has_next").value(false));

		mockMvc.perform(get(API + "/products?page=abc")).andExpect(jsonPath("$.pagination.current_page").value(1));
		mockMvc.perform(get(API + "/products?page=-1")).andExpect(jsonPath("$.pagination.current_page").value(1));
	}

	@Test
	void productsAllIsUnpagedOldestFirstWithoutNum() throws Exception {
		for (int i = 1; i <= 11; i++) {
			createProduct("產品" + i, 100);
		}

		mockMvc.perform(get(API + "/products/all"))
				.andExpect(jsonPath("$.products", hasSize(11)))
				.andExpect(jsonPath("$.products[0].title").value("產品1"))
				.andExpect(jsonPath("$.products[0].num").doesNotExist());
	}

	@Test
	void categoryFilterIsEchoedInPagination() throws Exception {
		createProduct("東京", "亞洲", 100, 1);
		createProduct("倫敦", "歐洲", 100, 1);

		mockMvc.perform(get(API + "/products").param("category", "歐洲"))
				.andExpect(jsonPath("$.products", hasSize(1)))
				.andExpect(jsonPath("$.products[0].title").value("倫敦"))
				.andExpect(jsonPath("$.pagination.category").value("歐洲"));
	}

	@Test
	void emptyListKeepsPaginationShape() throws Exception {
		mockMvc.perform(get(API + "/products"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.products", hasSize(0)))
				.andExpect(jsonPath("$.pagination.total_pages").value(0))
				.andExpect(jsonPath("$.pagination.current_page").value(0))
				.andExpect(jsonPath("$.pagination.has_pre").value(false))
				.andExpect(jsonPath("$.pagination.has_next").value(false));
	}

	@Test
	void adminAllIsKeyedById() throws Exception {
		String id = createProduct("東京", 100);

		adminGet(API + "/admin/products/all")
				.andExpect(jsonPath("$.products['" + id + "'].title").value("東京"));
	}

	@Test
	void validationErrorsUseHexschoolMessageShape() throws Exception {
		Map<String, Object> body = new HashMap<>(productBody("x", "亞洲", 1, 1));
		@SuppressWarnings("unchecked")
		Map<String, Object> data = new HashMap<>((Map<String, Object>) body.get("data"));
		data.put("title", "");
		data.remove("price");

		adminPost(API + "/admin/product", data(data))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message", containsString("title 屬性不得為空")))
				.andExpect(jsonPath("$.message", containsString("price 屬性不得為空")));
		adminPost(API + "/admin/product", Map.of())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("data 屬性不得為空"));
	}

	@Test
	void malformedBodyAndFractionalPriceAreRejected() throws Exception {
		@SuppressWarnings("unchecked")
		Map<String, Object> data = new HashMap<>((Map<String, Object>) productBody("x", "亞洲", 1, 1).get("data"));
		data.put("price", 99.5);

		adminPost(API + "/admin/product", data(data))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("資料格式不正確"));
	}

	@Test
	void updateAndDeleteUnknownIdReturn404() throws Exception {
		adminPut(API + "/admin/product/missing", productBody("x", "亞洲", 1, 1))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("id 不存在"));
		mockMvc.perform(auth(delete(API + "/admin/product/missing")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到產品"));
	}

	@Test
	void deletingProductRemovesItFromCart() throws Exception {
		String id = createProduct("東京", 100);
		addToCart(id, 2);

		mockMvc.perform(auth(delete(API + "/admin/product/" + id)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已刪除產品"));

		mockMvc.perform(get(API + "/cart")).andExpect(jsonPath("$.data.carts", hasSize(0)));
	}
}
