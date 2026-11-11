package com.percyku.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import com.percyku.backend.cart.CartOwner;

/**
 * 每個 MockMvc 請求預設帶上同一個訪客的 X-Cart-Id，與前端相同。請求自己帶 X-Cart-Id 時以請求的為準；
 * 帶 token 時後端會忽略它。每個測試前清空購物車，所以共用同一個 id 不會互相影響。
 */
@TestConfiguration(proxyBeanMethods = false)
class GuestCartTestConfig {

	static final String GUEST_CART_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

	@Bean
	MockMvcBuilderCustomizer defaultGuestCart() {
		return builder -> builder.defaultRequest(get("/").header(CartOwner.HEADER, GUEST_CART_ID));
	}
}
