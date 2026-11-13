package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.dto.SignupRequest;

/** 會員中心：基本資料與變更密碼。 */
class MemberProfileApiTest extends ApiTestSupport {

	private static final String PROFILE = API + "/user/profile";
	private static final String PASSWORD = API + "/user/password";
	private static final String NEW_PASSWORD = "Journey2027";

	private ResultActions getProfile(String memberToken) throws Exception {
		return mockMvc.perform(get(PROFILE).header("Authorization", memberToken));
	}

	private ResultActions putProfile(String memberToken, Object body) throws Exception {
		return mockMvc.perform(put(PROFILE).header("Authorization", memberToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(body)));
	}

	private ResultActions putPassword(String memberToken, String current, String next) throws Exception {
		Map<String, Object> body = new HashMap<>();
		body.put("password", current);
		body.put("new_password", next);
		return mockMvc.perform(put(PASSWORD).header("Authorization", memberToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))));
	}

	private static Map<String, Object> profileBody(String name, String tel, String address) {
		Map<String, Object> profile = new HashMap<>();
		profile.put("name", name);
		if (tel != null) {
			profile.put("tel", tel);
		}
		if (address != null) {
			profile.put("address", address);
		}
		return data(profile);
	}

	private ResultActions memberSignin(String email, String password) throws Exception {
		return postJson(API + "/user/signin", Map.of("username", email, "password", password));
	}

	// ───────────── 基本資料 ─────────────

	@Test
	void newMemberHasEmptyTelAndAddress() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		getProfile(member)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.profile.email").value("traveler@example.com"))
				.andExpect(jsonPath("$.profile.name").value("王小明"))
				.andExpect(jsonPath("$.profile.tel").value(""))
				.andExpect(jsonPath("$.profile.address").value(""));
	}

	@Test
	void updateProfileTrimsFieldsAndIgnoresEmail() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		Map<String, Object> body = new HashMap<>();
		body.put("name", "  王大明 ");
		body.put("tel", " 0912345678 ");
		body.put("address", "  台北市信義區市府路1號 ");
		body.put("email", "hacker@example.com");

		putProfile(member, data(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新會員資料"))
				.andExpect(jsonPath("$.profile.email").value("traveler@example.com"))
				.andExpect(jsonPath("$.profile.name").value("王大明"))
				.andExpect(jsonPath("$.profile.tel").value("0912345678"))
				.andExpect(jsonPath("$.profile.address").value("台北市信義區市府路1號"));

		getProfile(member).andExpect(jsonPath("$.profile.tel").value("0912345678"));
		// 姓名同步到登入狀態（Header 顯示的姓名）
		mockMvc.perform(post(API + "/user/check").header("Authorization", member))
				.andExpect(jsonPath("$.name").value("王大明"))
				.andExpect(jsonPath("$.email").value("traveler@example.com"));
	}

	@Test
	void missingOrBlankTelAndAddressClearThem() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		putProfile(member, profileBody("王小明", "0912345678", "高雄市")).andExpect(status().isOk());

		putProfile(member, profileBody("王小明", null, "   "))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile.tel").value(""))
				.andExpect(jsonPath("$.profile.address").value(""));
		getProfile(member)
				.andExpect(jsonPath("$.profile.tel").value(""))
				.andExpect(jsonPath("$.profile.address").value(""));
	}

	@ParameterizedTest
	@ValueSource(strings = { "0912345", "09-1234-5678", "+886912345678", "0912 345 678", "091234567890123456789", "０９１２３４５６７８" })
	void updateProfileRejectsInvalidTel(String tel) throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putProfile(member, profileBody("王小明", tel, ""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("tel 需為 8–20 個數字"));
	}

	@Test
	void updateProfileAcceptsTelAndAddressBoundaries() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putProfile(member, profileBody("王小明", "12345678", "址".repeat(100))).andExpect(status().isOk());
		putProfile(member, profileBody("王小明", "1".repeat(20), "")).andExpect(status().isOk());
		putProfile(member, profileBody("王小明", "", "址".repeat(101)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("address 不得超過 100 個字"));
	}

	@Test
	void updateProfileValidatesName() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putProfile(member, profileBody("   ", "123", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("name 屬性不得為空、tel 需為 8–20 個數字"));
		putProfile(member, profileBody("名".repeat(31), null, null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("name 不得超過 30 個字"));
		putProfile(member, Map.of("name", "王小明"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("data 屬性不得為空"));
		getProfile(member).andExpect(jsonPath("$.profile.name").value("王小明"));
	}

	@Test
	void profileRequiresToken() throws Exception {
		mockMvc.perform(get(PROFILE))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.message").value("驗證錯誤, 請重新登入"));
		mockMvc.perform(put(PROFILE).contentType(MediaType.APPLICATION_JSON).content(json(profileBody("王", null, null))))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(put(PASSWORD).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("password", "a", "new_password", "b")))))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void membersOnlySeeTheirOwnProfile() throws Exception {
		String alice = signupMember("alice@example.com", "Alice");
		String bob = signupMember("bob@example.com", "Bob");
		putProfile(alice, profileBody("Alice", "0911111111", "台北")).andExpect(status().isOk());

		getProfile(bob)
				.andExpect(jsonPath("$.profile.email").value("bob@example.com"))
				.andExpect(jsonPath("$.profile.tel").value(""));
	}

	@Test
	void adminCanUseProfile() throws Exception {
		getProfile(token)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile.email").value(ADMIN_EMAIL));
		putProfile(token, profileBody("管理者", "0222222222", "")).andExpect(status().isOk());
	}

	// ───────────── 變更密碼 ─────────────

	@Test
	void changePasswordRevokesOldTokensAndReturnsNewOne() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		String otherDevice = read(memberSignin("traveler@example.com", MEMBER_PASSWORD)).get("token").asText();

		JsonNode body = read(putPassword(member, MEMBER_PASSWORD, NEW_PASSWORD)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已變更密碼")));
		String fresh = body.get("token").asText();
		assertThat(body.get("expired").asLong()).isGreaterThan(System.currentTimeMillis());

		getProfile(member).andExpect(status().isUnauthorized());
		getProfile(otherDevice).andExpect(status().isUnauthorized());
		getProfile(fresh).andExpect(status().isOk());

		memberSignin("traveler@example.com", MEMBER_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
		memberSignin("traveler@example.com", NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void changePasswordRejectsWrongCurrentPassword() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putPassword(member, "Wrong2026", NEW_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("目前的密碼不正確"));
		getProfile(member).andExpect(status().isOk());
		memberSignin("traveler@example.com", MEMBER_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void changePasswordRejectsSamePassword() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putPassword(member, MEMBER_PASSWORD, MEMBER_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("新密碼不能與目前的密碼相同"));
		getProfile(member).andExpect(status().isOk());
	}

	@ParameterizedTest
	@ValueSource(strings = { "Abc1234", "abcdefgh", "12345678", "Travel 2027", "旅遊Travel2027" })
	void changePasswordAppliesSignupRules(String next) throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putPassword(member, MEMBER_PASSWORD, next)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(SignupRequest.PASSWORD_RULE));
	}

	@Test
	void changePasswordReportsBlankFields() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		putPassword(member, "", "")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("new_password 屬性不得為空、password 屬性不得為空"));
		putPassword(member, null, null)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("new_password 屬性不得為空、password 屬性不得為空"));
	}

	/** 與登入共用計數：猜錯 5 次後連正確的目前密碼與登入都被擋。 */
	@Test
	void wrongCurrentPasswordCountsTowardsSigninLimit() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		for (int i = 0; i < 5; i++) {
			putPassword(member, "Wrong2026", NEW_PASSWORD).andExpect(status().isBadRequest());
		}

		putPassword(member, MEMBER_PASSWORD, NEW_PASSWORD)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().exists("Retry-After"))
				.andExpect(jsonPath("$.message").value("登入失敗次數過多，請 15 分鐘後再試"));
		memberSignin("traveler@example.com", MEMBER_PASSWORD).andExpect(status().isTooManyRequests());
	}

	@Test
	void adminCanChangePasswordToo() throws Exception {
		String fresh = read(putPassword(token, "Test123456", NEW_PASSWORD).andExpect(status().isOk()))
				.get("token").asText();
		// 還原，其他測試以預設密碼登入
		putPassword(fresh, NEW_PASSWORD, "Test123456").andExpect(status().isOk());
	}
}
