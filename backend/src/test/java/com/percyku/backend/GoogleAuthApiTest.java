package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.security.GoogleTokenVerifier;

/**
 * Google 登入、註冊、連結與設定密碼。以 sub 辨識 Google 帳號，email 相同也不自動合併。
 * ID token 以測試金鑰簽出，見 GoogleTestTokens。
 */
class GoogleAuthApiTest extends ApiTestSupport {

	private static final String GOOGLE = API + "/user/google";
	private static final String LINK = API + "/user/google/link";

	private ResultActions googleSignin(String credential) throws Exception {
		return postJson(GOOGLE, data(Map.of("credential", credential)));
	}

	private String googleToken(String credential) throws Exception {
		return read(googleSignin(credential).andExpect(status().isOk())).get("token").asText();
	}

	private ResultActions link(String asToken, String credential) throws Exception {
		return mockMvc.perform(post(LINK).header("Authorization", asToken).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("credential", credential)))));
	}

	private ResultActions unlink(String asToken) throws Exception {
		return mockMvc.perform(delete(LINK).header("Authorization", asToken));
	}

	private ResultActions profile(String asToken) throws Exception {
		return mockMvc.perform(get(API + "/user/profile").header("Authorization", asToken));
	}

	private ResultActions setPassword(String asToken, Map<String, Object> body) throws Exception {
		return mockMvc.perform(put(API + "/user/password").header("Authorization", asToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))));
	}

	private ResultActions passwordSignin(String email, String password) throws Exception {
		return postJson(API + "/user/signin", Map.of("username", email, "password", password));
	}

	// ───────────── 設定 ─────────────

	@Test
	void configExposesClientId() throws Exception {
		mockMvc.perform(get(GOOGLE + "/config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.enabled").value(true))
				.andExpect(jsonPath("$.client_id").value(GoogleTestTokens.CLIENT_ID));
	}

	/** 沒有設定 client ID 時關閉。整個測試共用一組設定，所以直接建立 verifier 檢查 */
	@Test
	void verifierIsDisabledWithoutClientId() {
		GoogleTokenVerifier disabled = new GoogleTokenVerifier(new AppProperties(null, null, null, null, null, null,
				new AppProperties.Google("  ", null)));

		assertThat(disabled.isEnabled()).isFalse();
		assertThat(disabled.clientId()).isEmpty();
		assertThatThrownBy(() -> disabled.verify("anything"))
				.isInstanceOf(ApiException.class)
				.hasMessage("未設定 Google 登入");
	}

	// ───────────── 登入與註冊 ─────────────

	@Test
	void firstGoogleSigninCreatesUserWithoutPassword() throws Exception {
		JsonNode body = read(googleSignin(GoogleTestTokens.token("google-1", "Traveler@Gmail.com", "  王小明 "))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("註冊成功")));
		String token = body.get("token").asText();

		mockMvc.perform(post(API + "/user/check").header("Authorization", token))
				.andExpect(jsonPath("$.email").value("traveler@gmail.com"))
				.andExpect(jsonPath("$.name").value("王小明"))
				.andExpect(jsonPath("$.roles", contains("USER")));
		profile(token)
				.andExpect(jsonPath("$.profile.has_password").value(false))
				.andExpect(jsonPath("$.profile.google_email").value("traveler@gmail.com"));
	}

	@Test
	void laterSigninsUseSubEvenIfGoogleEmailChanged() throws Exception {
		String uid = read(googleSignin(GoogleTestTokens.token("google-1", "old@gmail.com", "王小明"))).get("uid").asText();

		googleSignin(GoogleTestTokens.token("google-1", "new@gmail.com", "改名了"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(uid));
		assertThat(userRepository.findByEmail("new@gmail.com")).isEmpty();
	}

	@Test
	void nameFallsBackToEmailAndIsTruncated() throws Exception {
		String noName = googleToken(GoogleTestTokens.builder("google-1", "nameless@gmail.com", null).sign());
		mockMvc.perform(post(API + "/user/check").header("Authorization", noName))
				.andExpect(jsonPath("$.name").value("nameless"));

		String longName = googleToken(GoogleTestTokens.token("google-2", "long@gmail.com", "名".repeat(40)));
		mockMvc.perform(post(API + "/user/check").header("Authorization", longName))
				.andExpect(jsonPath("$.name").value("名".repeat(30)));
	}

	/** 情境 1：先註冊，後用 Google 登入，同一個 email → 不自動合併 */
	@Test
	void existingEmailIsNotMergedAutomatically() throws Exception {
		signupMember("traveler@gmail.com", "王小明");

		googleSignin(GoogleTestTokens.token("google-1", "TRAVELER@gmail.com", "冒名者"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Google"));
		assertThat(userIdentityRepository.count()).isZero();
		// 預設 admin 也一樣
		googleSignin(GoogleTestTokens.token("google-2", ADMIN_EMAIL, "admin")).andExpect(status().isConflict());
	}

	/** 情境 2：先用 Google 登入，後註冊，同一個 email → 註冊被拒，提示改用原本的方式 */
	@Test
	void signupWithGoogleUsersEmailIsRejected() throws Exception {
		googleToken(GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"));

		postJson(API + "/user/signup", data(Map.of("email", "traveler@gmail.com", "password", MEMBER_PASSWORD,
				"name", "冒名者")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請改用原本的方式登入（例如 Google）"));
	}

	@Test
	void passwordSigninToGoogleOnlyAccountFailsLikeWrongPassword() throws Exception {
		googleToken(GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"));

		passwordSignin("traveler@gmail.com", MEMBER_PASSWORD)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
		postJson("/admin/signin", Map.of("username", "traveler@gmail.com", "password", MEMBER_PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
	}

	@Test
	void unverifiedEmailCannotCreateAccount() throws Exception {
		googleSignin(GoogleTestTokens.builder("google-1", "traveler@example.com", "王小明")
				.claim("email_verified", false).sign())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Google 帳號的 Email 尚未驗證"));
		// 舊版 Google 以字串表示
		googleSignin(GoogleTestTokens.builder("google-1", "traveler@example.com", "王小明")
				.claim("email_verified", "true").sign())
				.andExpect(status().isOk());
	}

	@Test
	void rejectsInvalidTokens() throws Exception {
		String[] invalid = {
				GoogleTestTokens.builder("google-1", "a@gmail.com", "A").signedWithOtherKey().sign(),
				GoogleTestTokens.builder("google-1", "a@gmail.com", "A").audience("someone-else").sign(),
				GoogleTestTokens.builder("google-1", "a@gmail.com", "A").issuer("https://evil.example.com").sign(),
				GoogleTestTokens.builder("google-1", "a@gmail.com", "A").expiredAt(Instant.now().minusSeconds(3600))
						.sign(),
				"not-a-jwt",
		};
		for (String credential : invalid) {
			googleSignin(credential)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("Google 驗證失敗，請再試一次"));
		}
		// iss 不含 https:// 也是 Google 的合法寫法
		googleSignin(GoogleTestTokens.builder("google-1", "a@gmail.com", "A").issuer("accounts.google.com").sign())
				.andExpect(status().isOk());
		googleSignin(" ")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("credential 屬性不得為空"));
		assertThat(userRepository.findByEmail("a@gmail.com")).isPresent();
	}

	// ───────────── 連結與解除連結 ─────────────

	@Test
	void memberLinksGoogleThenSignsInWithIt() throws Exception {
		String member = signupMember("traveler@gmail.com", "王小明");
		String uid = userRepository.findByEmail("traveler@gmail.com").orElseThrow().getId();

		link(member, GoogleTestTokens.token("google-1", "Traveler@gmail.com", "王小明"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已連結 Google"))
				.andExpect(jsonPath("$.profile.google_email").value("traveler@gmail.com"))
				.andExpect(jsonPath("$.profile.has_password").value(true));

		googleSignin(GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(uid));
		// 密碼也仍然可以登入
		passwordSignin("traveler@gmail.com", MEMBER_PASSWORD).andExpect(status().isOk());
		// 再連結同一個不做事
		link(member, GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明")).andExpect(status().isOk());
	}

	@Test
	void linkedGoogleEmailMayDifferFromAccountEmail() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		link(member, GoogleTestTokens.token("google-1", "someone.else@gmail.com", "王小明"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile.email").value("traveler@example.com"))
				.andExpect(jsonPath("$.profile.google_email").value("someone.else@gmail.com"));
	}

	/** 連結的人已證明擁有這個 Gmail，之後不能再用它以密碼註冊另一個帳號（否則 Google 與密碼登入會進到不同帳號） */
	@Test
	void emailLinkedAsGoogleCannotBeUsedToSignUp() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		link(member, GoogleTestTokens.token("google-1", "Linked@gmail.com", "王小明")).andExpect(status().isOk());

		postJson(API + "/user/signup", data(Map.of("email", "LINKED@gmail.com", "password", MEMBER_PASSWORD,
				"name", "另一個人")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請改用原本的方式登入（例如 Google）"));
		// 另一個 Google 帳號帶著同一個 email（例如非 Gmail 的信箱掛在兩個 Google 帳號上）也不能建立新帳號
		googleSignin(GoogleTestTokens.token("google-2", "linked@gmail.com", "另一個人"))
				.andExpect(status().isConflict());
		assertThat(userRepository.findByEmail("linked@gmail.com")).isEmpty();

		// 解除連結後這個 email 就可以註冊
		unlink(member).andExpect(status().isOk());
		postJson(API + "/user/signup", data(Map.of("email", "linked@gmail.com", "password", MEMBER_PASSWORD,
				"name", "另一個人"))).andExpect(status().isOk());
	}

	/** 反方向：別人先以這個 email 註冊（未驗證），信箱的主人仍可以把這個 Gmail 連結到自己的帳號 */
	@Test
	void unverifiedSignupDoesNotBlockLinking() throws Exception {
		signupMember("owner@gmail.com", "搶先註冊的人");
		String owner = signupMember("owner@example.com", "信箱的主人");

		link(owner, GoogleTestTokens.token("google-1", "owner@gmail.com", "信箱的主人"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile.google_email").value("owner@gmail.com"));
		// 以 Google 登入進的是信箱主人的帳號
		googleSignin(GoogleTestTokens.token("google-1", "owner@gmail.com", "信箱的主人"))
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(userRepository.findByEmail("owner@example.com").orElseThrow().getId()));
	}

	@Test
	void googleAccountCanOnlyBelongToOneMember() throws Exception {
		googleToken(GoogleTestTokens.token("google-1", "first@gmail.com", "First"));
		String other = signupMember("other@example.com", "Other");

		link(other, GoogleTestTokens.token("google-1", "first@gmail.com", "First"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("這個 Google 帳號已連結其他會員"));
	}

	@Test
	void memberCanLinkOnlyOneGoogleAccount() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		link(member, GoogleTestTokens.token("google-1", "a@gmail.com", "A")).andExpect(status().isOk());

		link(member, GoogleTestTokens.token("google-2", "b@gmail.com", "B"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("已連結其他 Google 帳號，請先解除連結"));
	}

	@Test
	void unlinkKeepsAtLeastOneSigninMethod() throws Exception {
		String googleOnly = googleToken(GoogleTestTokens.token("google-1", "only@gmail.com", "Only"));
		unlink(googleOnly)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("至少要保留一種登入方式，請先設定密碼"));

		String member = signupMember("traveler@example.com", "王小明");
		link(member, GoogleTestTokens.token("google-2", "traveler@gmail.com", "王小明"));
		unlink(member)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已解除連結 Google"))
				.andExpect(jsonPath("$.profile.google_email").doesNotExist());
		googleSignin(GoogleTestTokens.token("google-2", "traveler@gmail.com", "王小明"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("註冊成功")); // 解除後是另一個新帳號
		// 沒有連結時解除不做事
		unlink(signupMember("plain@example.com", "Plain")).andExpect(status().isOk());
	}

	@Test
	void linkRequiresToken() throws Exception {
		mockMvc.perform(post(LINK).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("credential", "x"))))).andExpect(status().isUnauthorized());
		mockMvc.perform(delete(LINK)).andExpect(status().isUnauthorized());
	}

	// ───────────── 設定密碼 ─────────────

	@Test
	void googleOnlyAccountSetsPasswordWithFreshGoogleCredential() throws Exception {
		String token = googleToken(GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"));
		Map<String, Object> body = new HashMap<>();
		body.put("new_password", "Journey2027");
		body.put("credential", GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"));

		JsonNode result = read(setPassword(token, body)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已設定密碼")));

		profile(token).andExpect(status().isUnauthorized()); // 既有 token 失效
		profile(result.get("token").asText()).andExpect(jsonPath("$.profile.has_password").value(true));
		passwordSignin("traveler@gmail.com", "Journey2027").andExpect(status().isOk());
		// 之後就是一般的變更密碼，要帶目前的密碼
		setPassword(result.get("token").asText(), Map.of("new_password", "Another2028"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("password 屬性不得為空"));
	}

	@Test
	void settingPasswordRequiresTheLinkedGoogleAccount() throws Exception {
		String token = googleToken(GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明"));

		setPassword(token, Map.of("new_password", "Journey2027"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("credential 屬性不得為空"));
		// 其他 Google 帳號、無效的 token 都不行；帶了 password 也沒用
		for (String credential : new String[] {
				GoogleTestTokens.token("google-2", "attacker@gmail.com", "Attacker"),
				GoogleTestTokens.builder("google-1", "traveler@gmail.com", "王小明").signedWithOtherKey().sign() }) {
			setPassword(token, Map.of("new_password", "Journey2027", "credential", credential, "password", "x"))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("Google 驗證失敗，請以已連結的 Google 帳號驗證"));
		}
		setPassword(token, Map.of("new_password", "short", "credential",
				GoogleTestTokens.token("google-1", "traveler@gmail.com", "王小明")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(com.percyku.backend.dto.SignupRequest.PASSWORD_RULE));
		profile(token).andExpect(jsonPath("$.profile.has_password").value(false));
	}
}
