package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.dto.SignupRequest;

/** 註冊、前台登入，以及一般會員與管理者的權限分界。 */
class MemberAuthApiTest extends ApiTestSupport {

	private static final String SIGNUP = API + "/user/signup";
	private static final String SIGNIN = API + "/user/signin";

	private static Map<String, Object> signupBody(String email, String password, String name) {
		Map<String, Object> user = new HashMap<>();
		user.put("email", email);
		user.put("password", password);
		user.put("name", name);
		return data(user);
	}

	private JsonNode check(String memberToken) throws Exception {
		return read(mockMvc.perform(post(API + "/user/check").header("Authorization", memberToken))
				.andExpect(status().isOk()));
	}

	@Test
	void signupCreatesUserRoleAccountAndLogsIn() throws Exception {
		JsonNode body = read(postJson(SIGNUP, signupBody("  Traveler@Example.COM ", MEMBER_PASSWORD, "  王小明  "))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.message").value("註冊成功")));
		assertThat(body.get("expired").asLong()).isGreaterThan(System.currentTimeMillis());

		JsonNode me = check(body.get("token").asText());
		assertThat(me.get("uid").asText()).isEqualTo(body.get("uid").asText());
		assertThat(me.get("email").asText()).isEqualTo("traveler@example.com");
		assertThat(me.get("name").asText()).isEqualTo("王小明");
		assertThat(me.get("roles")).hasSize(1);
		assertThat(me.get("roles").get(0).asText()).isEqualTo("USER");
	}

	@ParameterizedTest
	@ValueSource(strings = { "traveler@example.com", "TRAVELER@example.com", "admin@gmail.com", "Admin@Gmail.com" })
	void signupRejectsExistingEmailIgnoringCase(String email) throws Exception {
		signupMember("traveler@example.com", "王小明");
		long before = userRepository.count();

		postJson(SIGNUP, signupBody(email, MEMBER_PASSWORD, "冒名者"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請改用原本的方式登入（例如 Google）"));
		assertThat(userRepository.count()).isEqualTo(before);
	}

	@Test
	void signupReportsEveryBlankField() throws Exception {
		postJson(SIGNUP, signupBody("", "", "   "))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("email 屬性不得為空、name 屬性不得為空、password 屬性不得為空"));
		postJson(SIGNUP, data(Map.of()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("email 屬性不得為空、name 屬性不得為空、password 屬性不得為空"));
		postJson(SIGNUP, Map.of("email", "traveler@example.com"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("data 屬性不得為空"));
	}

	@ParameterizedTest
	@ValueSource(strings = { "traveler", "traveler@", "traveler@example", "a b@example.com", "旅人@example.com" })
	void signupRejectsInvalidEmail(String email) throws Exception {
		postJson(SIGNUP, signupBody(email, MEMBER_PASSWORD, "王小明"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("email 格式不正確"));
	}

	@ParameterizedTest
	@ValueSource(strings = {
			"Abc1234", // 7 個字元
			"abcdefgh", // 沒有數字
			"12345678", // 沒有英文字母
			"Travel 2026", // 空白
			"旅遊Travel2026", // 非 ASCII
			"A1234567890123456789012345678901234567890123456789012345678901234", // 65 個字元
	})
	void signupRejectsWeakOrInvalidPassword(String password) throws Exception {
		postJson(SIGNUP, signupBody("traveler@example.com", password, "王小明"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(SignupRequest.PASSWORD_RULE));
	}

	@Test
	void signupAcceptsPasswordBoundaries() throws Exception {
		postJson(SIGNUP, signupBody("short@example.com", "Abc12345", "八個字元")).andExpect(status().isOk());
		postJson(SIGNUP, signupBody("long@example.com", "A1" + "!".repeat(62), "六十四個字元")).andExpect(status().isOk());
	}

	@Test
	void signupLimitsNameLength() throws Exception {
		postJson(SIGNUP, signupBody("long-name@example.com", MEMBER_PASSWORD, "名".repeat(31)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("name 不得超過 30 個字"));
		postJson(SIGNUP, signupBody("long-name@example.com", MEMBER_PASSWORD, "名".repeat(30)))
				.andExpect(status().isOk());
	}

	@Test
	void memberSigninIgnoresEmailCase() throws Exception {
		signupMember("traveler@example.com", "王小明");

		JsonNode body = read(postJson(SIGNIN, Map.of("username", " Traveler@Example.com", "password", MEMBER_PASSWORD))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功")));
		assertThat(check(body.get("token").asText()).get("email").asText()).isEqualTo("traveler@example.com");
	}

	@Test
	void memberSigninFailureDoesNotRevealWhichFieldIsWrong() throws Exception {
		signupMember("traveler@example.com", "王小明");

		postJson(SIGNIN, Map.of("username", "traveler@example.com", "password", "Wrong2026"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
		postJson(SIGNIN, Map.of("username", "nobody@example.com", "password", MEMBER_PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
		postJson(SIGNIN, Map.of("username", "", "password", ""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("password 屬性不得為空、username 屬性不得為空"));
	}

	/** bcrypt 只處理 72 bytes；確認超過時是登入失敗而不是 500，升級 Spring Security 時行為若改變會在這裡發現。 */
	@Test
	void passwordLongerThanBcryptLimitIsTreatedAsWrongPassword() throws Exception {
		postJson(SIGNIN, Map.of("username", ADMIN_EMAIL, "password", "x".repeat(100)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
	}

	@Test
	void adminCanSignInOnFrontSite() throws Exception {
		String adminToken = read(postJson(SIGNIN, Map.of("username", ADMIN_EMAIL, "password", "Test123456"))
				.andExpect(status().isOk())).get("token").asText();
		assertThat(check(adminToken).get("roles").get(0).asText()).isEqualTo("ADMIN");
	}

	@Test
	void adminSigninRejectsMemberWithoutCountingFailure() throws Exception {
		signupMember("traveler@example.com", "王小明");

		// 失敗上限是 5 次；沒有權限不算失敗，所以第 6 次仍然是 403 而不是 429
		for (int i = 0; i < 6; i++) {
			postJson("/admin/signin", Map.of("username", "traveler@example.com", "password", MEMBER_PASSWORD))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.success").value(false))
					.andExpect(jsonPath("$.message").value("此帳號沒有後台權限"));
		}
		postJson("/admin/signin", Map.of("username", "traveler@example.com", "password", "Wrong2026"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
	}

	@Test
	void frontAndAdminSigninShareAttemptLimit() throws Exception {
		signupMember("traveler@example.com", "王小明");
		for (int i = 0; i < 5; i++) {
			postJson(SIGNIN, Map.of("username", "traveler@example.com", "password", "Wrong2026"))
					.andExpect(status().isBadRequest());
		}

		postJson("/admin/signin", Map.of("username", "TRAVELER@example.com", "password", MEMBER_PASSWORD))
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists("Retry-After"));
	}

	@ParameterizedTest
	@CsvSource({
			"GET, /api/admin/products",
			"GET, /api/admin/orders",
			"GET, /api/admin/coupons",
			"GET, /api/admin/articles",
			"GET, /api/orders",
			"POST, /api/admin/product",
	})
	void memberTokenCannotUseAdminApi(String method, String path) throws Exception {
		String memberToken = signupMember("traveler@example.com", "王小明");
		var request = method.equals("GET") ? get(path) : post(path);

		mockMvc.perform(request.header("Authorization", memberToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("無此權限"));
	}

	@Test
	void memberLogoutRevokesOnlyThatMembersTokens() throws Exception {
		String memberToken = signupMember("traveler@example.com", "王小明");

		mockMvc.perform(post("/logout").header("Authorization", memberToken)).andExpect(status().isOk());

		mockMvc.perform(post(API + "/user/check").header("Authorization", memberToken))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(auth(post(API + "/user/check"))).andExpect(status().isOk());
	}
}
