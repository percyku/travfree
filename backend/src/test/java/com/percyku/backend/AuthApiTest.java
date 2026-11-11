package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.DefaultApplicationArguments;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AdminSeeder;

class AuthApiTest extends ApiTestSupport {

	private static final String UNAUTHORIZED = "驗證錯誤, 請重新登入";

	@Autowired
	AdminSeeder adminSeeder;

	@Test
	void signinReturnsTokenAndExpiryInMilliseconds() throws Exception {
		JsonNode body = read(postJson("/admin/signin", Map.of("username", "admin@gmail.com", "password", "Test123456"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").isNotEmpty()));

		assertThat(body.get("expired").asLong()).isGreaterThan(System.currentTimeMillis());
		// 前端用 split("=")[1] 從 cookie 取 token，token 內不能有等號
		assertThat(body.get("token").asText()).doesNotContain("=");
	}

	@Test
	void signinFailureDoesNotRevealWhichFieldIsWrong() throws Exception {
		postJson("/admin/signin", Map.of("username", "admin@gmail.com", "password", "wrong-password"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("登入失敗"));
		postJson("/admin/signin", Map.of("username", "nobody@gmail.com", "password", "Test123456"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
	}

	@Test
	void seederDoesNotCreateDuplicateAdmin() throws Exception {
		long before = userRepository.count();
		ApplicationArguments args = new DefaultApplicationArguments();
		adminSeeder.run(args);
		assertThat(userRepository.count()).isEqualTo(before);
	}

	@Test
	void userCheckAcceptsRawTokenAndBearerToken() throws Exception {
		mockMvc.perform(post("/api/user/check").header("Authorization", token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.uid").isNotEmpty())
				.andExpect(jsonPath("$.email").value("admin@gmail.com"))
				.andExpect(jsonPath("$.name").value("管理者"))
				// 預設 admin 是純後台帳號，沒有 USER
				.andExpect(jsonPath("$.roles.length()").value(1))
				.andExpect(jsonPath("$.roles[0]").value("ADMIN"));
		mockMvc.perform(post("/api/user/check").header("Authorization", "Bearer " + token))
				.andExpect(status().isOk());
	}

	@Test
	void missingOrInvalidTokenIsRejectedWith401() throws Exception {
		mockMvc.perform(post("/api/user/check"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value(UNAUTHORIZED));
		mockMvc.perform(get(API + "/admin/products").header("Authorization", "not-a-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value(UNAUTHORIZED));
	}

	@Test
	void invalidTokenDoesNotBreakPublicApi() throws Exception {
		mockMvc.perform(get(API + "/products").header("Authorization", "expired-or-garbage"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true));
	}

	@Test
	void logoutRevokesExistingTokens() throws Exception {
		mockMvc.perform(auth(post("/logout"))).andExpect(status().isOk());

		mockMvc.perform(auth(post("/api/user/check"))).andExpect(status().isUnauthorized());
		// 重新登入取得的新 token 可以使用
		token = signin();
		mockMvc.perform(auth(post("/api/user/check"))).andExpect(status().isOk());
	}

	@Test
	void logoutWithoutTokenStillSucceeds() throws Exception {
		mockMvc.perform(post("/logout"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true));
	}

	@Test
	void orderListRequiresAdminToken() throws Exception {
		mockMvc.perform(get(API + "/orders")).andExpect(status().isUnauthorized());
		adminGet(API + "/orders").andExpect(status().isOk());
	}

	@Test
	void everyAdminRouteRequiresToken() throws Exception {
		mockMvc.perform(post(API + "/admin/product")).andExpect(status().isUnauthorized());
		mockMvc.perform(post(API + "/admin/upload")).andExpect(status().isUnauthorized());
		mockMvc.perform(get(API + "/admin/orders")).andExpect(status().isUnauthorized());
		mockMvc.perform(get(API + "/admin/coupons")).andExpect(status().isUnauthorized());
		mockMvc.perform(get(API + "/admin/articles")).andExpect(status().isUnauthorized());
	}
}
