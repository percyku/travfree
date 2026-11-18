package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.security.oauth.FacebookOAuthClient;

/**
 * Facebook 登入（授權碼流程）。Facebook 由 FakeFacebook 模擬。
 * 登入、註冊、連結的共用規則在 GitHubAuthApiTest 測過（IdentityService），這裡測 Facebook 特有的部分：
 * Graph API 的格式、appsecret_proof、沒有 email、app 專用的 id。
 */
class FacebookAuthApiTest extends ApiTestSupport {

	private static final String SIGNIN = API + "/user/oauth/facebook";
	private static final String LINK = SIGNIN + "/link";
	private static final FakeFacebook.User ALICE = FakeFacebook.user("10229876543210", "陳美玲", "Alice@Example.com");

	private ResultActions facebookSignin(String code) throws Exception {
		return postJson(SIGNIN, data(Map.of("code", code, "redirect_uri", FakeFacebook.REDIRECT_URI)));
	}

	private String facebookToken(FakeFacebook.User user) throws Exception {
		return read(facebookSignin(FACEBOOK.authorize(user)).andExpect(status().isOk())).get("token").asText();
	}

	private ResultActions profile(String asToken) throws Exception {
		return mockMvc.perform(get(API + "/user/profile").header("Authorization", asToken));
	}

	@Test
	void configUsesAppIdAndEmailScope() throws Exception {
		mockMvc.perform(get(API + "/user/oauth/config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.providers.facebook.enabled").value(true))
				.andExpect(jsonPath("$.providers.facebook.client_id").value(FakeFacebook.APP_ID))
				.andExpect(jsonPath("$.providers.facebook.authorize_url").value(FACEBOOK.baseUrl() + "/dialog/oauth"))
				.andExpect(jsonPath("$.providers.facebook.scope").value("email"));
	}

	/** 整個測試共用一組設定，所以直接建立 client 檢查 */
	@Test
	void clientIsDisabledWithoutAppIdAndRejectsHalfConfiguration() {
		FacebookOAuthClient disabled = new FacebookOAuthClient(properties(new AppProperties.OAuthProvider(
				"", "", "https://www.facebook.com/v27.0/dialog/oauth", null, null)));
		assertThat(disabled.isEnabled()).isFalse();
		assertThat(disabled.authorizeUrl()).isEmpty();
		assertThat(disabled.scope()).isEmpty();
		assertThatThrownBy(() -> disabled.exchange("code", FakeFacebook.REDIRECT_URI, null, "x"))
				.isInstanceOfSatisfying(ApiException.class, e -> {
					assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
					assertThat(e.getMessage()).isEqualTo("未設定 Facebook 登入");
				});

		assertThatThrownBy(() -> new FacebookOAuthClient(properties(new AppProperties.OAuthProvider(
				"", "secret", null, null, null))))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("FACEBOOK_APP_ID 與 FACEBOOK_APP_SECRET");
	}

	private static AppProperties properties(AppProperties.OAuthProvider facebook) {
		return new AppProperties(null, null, null, null, null, null, null, null, facebook);
	}

	@Test
	void firstSigninCreatesAccountAndSendsAppSecretProof() throws Exception {
		JsonNode body = read(facebookSignin(FACEBOOK.authorize(ALICE))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("註冊成功")));

		profile(body.get("token").asText())
				.andExpect(jsonPath("$.profile.email").value("alice@example.com"))
				.andExpect(jsonPath("$.profile.name").value("陳美玲"))
				.andExpect(jsonPath("$.profile.has_password").value(false))
				.andExpect(jsonPath("$.profile.identities[0].provider").value("facebook"))
				.andExpect(jsonPath("$.profile.identities[0].email").value("alice@example.com"));

		assertThat(FACEBOOK.lastTokenQuery())
				.containsEntry("client_id", FakeFacebook.APP_ID)
				.containsEntry("client_secret", FakeFacebook.APP_SECRET)
				.containsEntry("redirect_uri", FakeFacebook.REDIRECT_URI)
				.doesNotContainKey("code_verifier");
		assertThat(FACEBOOK.lastMeQuery()).containsEntry("fields", "id,name,email").containsKey("appsecret_proof");
	}

	@Test
	void codeWithReservedCharactersIsEncoded() throws Exception {
		// Facebook 的 code 很長，可能含 + / = 等字元；+ 沒編碼的話會被當成空白
		String code = FACEBOOK.authorize(ALICE, "AQB+x/y=z&w#v_" + System.nanoTime());
		facebookSignin(code).andExpect(status().isOk());
		assertThat(FACEBOOK.lastTokenQuery()).containsEntry("code", code);
	}

	@Test
	void laterSigninsUseAppScopedIdEvenIfEmailChanged() throws Exception {
		String uid = read(facebookSignin(FACEBOOK.authorize(ALICE))).get("uid").asText();

		facebookSignin(FACEBOOK.authorize(FakeFacebook.user(ALICE.id(), "新名字", "new@example.com")))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(uid));
	}

	@Test
	void accountWithoutEmailCannotSignUpButCanBeLinked() throws Exception {
		FakeFacebook.User phoneOnly = FakeFacebook.user("10220000000001", "手機註冊", null);
		facebookSignin(FACEBOOK.authorize(phoneOnly))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 沒有提供 Email，請改用其他方式註冊"));

		String member = signupMember("member@example.com", "會員");
		mockMvc.perform(post(LINK).header("Authorization", member).contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("code", FACEBOOK.authorize(phoneOnly),
						"redirect_uri", FakeFacebook.REDIRECT_URI)))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已連結 Facebook"))
				.andExpect(jsonPath("$.profile.identities[0].provider").value("facebook"))
				.andExpect(jsonPath("$.profile.identities[0].email").isEmpty());
		facebookSignin(FACEBOOK.authorize(phoneOnly))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"));
	}

	@Test
	void existingEmailIsNotMergedAutomatically() throws Exception {
		signupMember("alice@example.com", "先註冊的人");

		facebookSignin(FACEBOOK.authorize(ALICE))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 Facebook"));
	}

	@Test
	void rejectsInvalidCodes() throws Exception {
		facebookSignin("never-issued")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 驗證失敗，請再試一次"));

		String code = FACEBOOK.authorize(ALICE);
		facebookSignin(code).andExpect(status().isOk());
		facebookSignin(code) // 只能用一次
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 驗證失敗，請再試一次"));

		postJson(SIGNIN, data(Map.of("code", FACEBOOK.authorize(ALICE), "redirect_uri", "http://localhost:8000/")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 驗證失敗，請再試一次"));
	}

	@Test
	void facebookOutageIsBadGateway() throws Exception {
		FACEBOOK.failToken(500);
		facebookSignin(FACEBOOK.authorize(ALICE))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.message").value("Facebook 暫時無法連線，請稍後再試"));
	}

	@Test
	void facebookOnlyAccountSetsPasswordWithFreshAuthorization() throws Exception {
		String token = facebookToken(ALICE);
		Map<String, Object> body = new HashMap<>();
		body.put("new_password", "Journey2027");
		body.put("oauth", Map.of("provider", "facebook", "code", FACEBOOK.authorize(ALICE),
				"redirect_uri", FakeFacebook.REDIRECT_URI));

		JsonNode result = read(mockMvc.perform(put(API + "/user/password").header("Authorization", token)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已設定密碼")));
		profile(result.get("token").asText()).andExpect(jsonPath("$.profile.has_password").value(true));

		// 別的 Facebook 帳號不行
		String other = facebookToken(FakeFacebook.user("10220000000002", "Bob", "bob@example.com"));
		body.put("oauth", Map.of("provider", "facebook", "code", FACEBOOK.authorize(ALICE),
				"redirect_uri", FakeFacebook.REDIRECT_URI));
		mockMvc.perform(put(API + "/user/password").header("Authorization", other)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 驗證失敗，請以已連結的 Facebook 帳號驗證"));
	}
}
