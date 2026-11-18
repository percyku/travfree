package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.config.AppProperties;
import com.percyku.backend.security.oauth.GitHubOAuthClient;

/**
 * GitHub 登入、註冊、連結與設定密碼（授權碼流程）。GitHub 由 FakeGitHub 模擬。
 * 以 GitHub 的數字 id 辨識，email 相同也不自動合併，規則與 Google 相同（IdentityService）。
 */
class GitHubAuthApiTest extends ApiTestSupport {

	private static final String OAUTH = API + "/user/oauth";
	private static final String GITHUB_SIGNIN = OAUTH + "/github";
	private static final String GITHUB_LINK = OAUTH + "/github/link";

	private static Map<String, Object> codeBody(String code) {
		return Map.of("code", code, "redirect_uri", FakeGitHub.REDIRECT_URI);
	}

	private ResultActions githubSignin(String code) throws Exception {
		return postJson(GITHUB_SIGNIN, data(codeBody(code)));
	}

	private ResultActions githubSignin(FakeGitHub.User user) throws Exception {
		return githubSignin(GITHUB.authorize(user));
	}

	private String githubToken(FakeGitHub.User user) throws Exception {
		return read(githubSignin(user).andExpect(status().isOk())).get("token").asText();
	}

	private ResultActions link(String asToken, FakeGitHub.User user) throws Exception {
		return mockMvc.perform(post(GITHUB_LINK).header("Authorization", asToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(data(codeBody(GITHUB.authorize(user))))));
	}

	private ResultActions unlink(String asToken, String provider) throws Exception {
		return mockMvc.perform(delete(OAUTH + "/" + provider + "/link").header("Authorization", asToken));
	}

	private ResultActions profile(String asToken) throws Exception {
		return mockMvc.perform(get(API + "/user/profile").header("Authorization", asToken));
	}

	private ResultActions setPassword(String asToken, Map<String, Object> body) throws Exception {
		return mockMvc.perform(put(API + "/user/password").header("Authorization", asToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))));
	}

	private static final FakeGitHub.User OCTOCAT = FakeGitHub.user(583231, "octocat", "王小明", "Traveler@Example.com");

	// ───────────── 設定 ─────────────

	@Test
	void configListsEveryProvider() throws Exception {
		mockMvc.perform(get(OAUTH + "/config"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.providers.github.enabled").value(true))
				.andExpect(jsonPath("$.providers.github.client_id").value(FakeGitHub.CLIENT_ID))
				.andExpect(jsonPath("$.providers.github.authorize_url").value(GITHUB.baseUrl() + "/login/oauth/authorize"))
				.andExpect(jsonPath("$.providers.github.scope").value("user:email"));
	}

	/** 整個測試共用一組設定，所以直接建立 client 檢查 */
	@Test
	void clientIsDisabledWithoutClientIdAndRejectsHalfConfiguration() {
		GitHubOAuthClient disabled = new GitHubOAuthClient(properties(new AppProperties.OAuthProvider(
				" ", null, "https://github.com/login/oauth/authorize", null, null)));
		assertThat(disabled.isEnabled()).isFalse();
		assertThat(disabled.clientId()).isEmpty();
		assertThat(disabled.authorizeUrl()).isEmpty();
		assertThat(disabled.scope()).isEmpty();

		assertThatThrownBy(() -> new GitHubOAuthClient(properties(new AppProperties.OAuthProvider(
				"id", "", null, null, null))))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("GITHUB_CLIENT_SECRET");
	}

	private static AppProperties properties(AppProperties.OAuthProvider github) {
		return new AppProperties(null, null, null, null, null, null, null, github, null);
	}

	// ───────────── 登入與註冊 ─────────────

	@Test
	void firstGitHubSigninCreatesUserWithoutPassword() throws Exception {
		JsonNode body = read(githubSignin(OCTOCAT)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("註冊成功")));

		String token = body.get("token").asText();
		mockMvc.perform(post(API + "/user/check").header("Authorization", token))
				.andExpect(jsonPath("$.email").value("traveler@example.com"))
				.andExpect(jsonPath("$.name").value("王小明"));
		profile(token)
				.andExpect(jsonPath("$.profile.has_password").value(false))
				.andExpect(jsonPath("$.profile.identities.length()").value(1))
				.andExpect(jsonPath("$.profile.identities[0].provider").value("github"))
				.andExpect(jsonPath("$.profile.identities[0].email").value("traveler@example.com"));

		// 送給 GitHub 的內容：client secret 只在後端，redirect_uri 原樣轉交
		Map<String, String> sent = GITHUB.lastTokenRequest();
		assertThat(sent).containsEntry("client_id", FakeGitHub.CLIENT_ID)
				.containsEntry("client_secret", FakeGitHub.CLIENT_SECRET)
				.containsEntry("redirect_uri", FakeGitHub.REDIRECT_URI)
				.doesNotContainKey("code_verifier");
	}

	@Test
	void laterSigninsUseGitHubIdEvenIfLoginAndEmailChanged() throws Exception {
		String uid = read(githubSignin(OCTOCAT)).get("uid").asText();

		githubSignin(FakeGitHub.user(583231, "renamed", "新名字", "new@example.com"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(uid));
	}

	@Test
	void nameFallsBackToLoginAndIsTruncated() throws Exception {
		String token = githubToken(FakeGitHub.user(1, "octo-login", null, "a@example.com"));
		profile(token).andExpect(jsonPath("$.profile.name").value("octo-login"));

		String longName = "很".repeat(40);
		String other = githubToken(FakeGitHub.user(2, "long", longName, "b@example.com"));
		profile(other).andExpect(jsonPath("$.profile.name").value("很".repeat(30)));
	}

	@Test
	void pkceVerifierIsForwardedAndMustMatch() throws Exception {
		String code = GITHUB.authorize(OCTOCAT, FakeGitHub.REDIRECT_URI, "verifier-123");
		postJson(GITHUB_SIGNIN, data(Map.of("code", code, "redirect_uri", FakeGitHub.REDIRECT_URI,
				"code_verifier", "wrong")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 驗證失敗，請再試一次"));

		String fresh = GITHUB.authorize(OCTOCAT, FakeGitHub.REDIRECT_URI, "verifier-123");
		postJson(GITHUB_SIGNIN, data(Map.of("code", fresh, "redirect_uri", FakeGitHub.REDIRECT_URI,
				"code_verifier", "verifier-123")))
				.andExpect(status().isOk());
		assertThat(GITHUB.lastTokenRequest()).containsEntry("code_verifier", "verifier-123");
	}

	@Test
	void rejectsInvalidCodes() throws Exception {
		githubSignin("never-issued")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 驗證失敗，請再試一次"));

		// code 只能用一次
		String code = GITHUB.authorize(OCTOCAT);
		githubSignin(code).andExpect(status().isOk());
		githubSignin(code)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 驗證失敗，請再試一次"));

		// redirect_uri 要與導向授權頁時相同
		String other = GITHUB.authorize(OCTOCAT);
		postJson(GITHUB_SIGNIN, data(Map.of("code", other, "redirect_uri", "http://localhost:8000/")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 驗證失敗，請再試一次"));
	}

	@Test
	void validatesRequestBody() throws Exception {
		postJson(GITHUB_SIGNIN, data(Map.of("redirect_uri", FakeGitHub.REDIRECT_URI)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("code 屬性不得為空"));
		postJson(GITHUB_SIGNIN, data(Map.of("code", "abc")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("redirect_uri 屬性不得為空"));
		postJson(GITHUB_SIGNIN, Map.of())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("data 屬性不得為空"));
	}

	@Test
	void unknownProvider() throws Exception {
		postJson(OAUTH + "/twitter", data(codeBody("abc")))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到這個登入方式"));
	}

	@Test
	void gitHubOutageIsBadGateway() throws Exception {
		GITHUB.failToken(500);
		githubSignin(OCTOCAT)
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.message").value("GitHub 暫時無法連線，請稍後再試"));

		GITHUB.reset();
		GITHUB.failUser(503);
		githubSignin(OCTOCAT)
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.message").value("GitHub 暫時無法連線，請稍後再試"));
	}

	@Test
	void accountWithoutVerifiedPrimaryEmailCannotSignUp() throws Exception {
		// 只有 noreply 的 email（不是 primary）
		githubSignin(FakeGitHub.user(10, "noemail", "No Email", null))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊"));

		// primary 但未驗證
		githubSignin(new FakeGitHub.User(11, "unverified", "U",
				List.of(FakeGitHub.email("unverified@example.com", true, false))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊"));

		// 沒有 user:email 權限
		GITHUB.failEmails(403);
		githubSignin(OCTOCAT)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("GitHub 帳號沒有已驗證的 Email，請改用其他方式註冊"));
		assertThat(userRepository.findByEmail("traveler@example.com")).isEmpty();
	}

	@Test
	void existingEmailIsNotMergedAutomatically() throws Exception {
		signupMember("traveler@example.com", "先註冊的人");

		githubSignin(OCTOCAT)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 GitHub"));
		assertThat(userIdentityRepository.count()).isZero();
	}

	@Test
	void emailLinkedByAnotherPlatformIsTaken() throws Exception {
		// 另一個會員把 Google 連結到這個 email
		String member = signupMember("owner@example.com", "Owner");
		mockMvc.perform(post(API + "/user/google/link").header("Authorization", member)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("credential",
						GoogleTestTokens.token("google-1", "traveler@example.com", "王小明"))))))
				.andExpect(status().isOk());

		githubSignin(OCTOCAT)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請先用原本的方式登入，再到會員中心連結 GitHub"));
	}

	@Test
	void emailOfGitHubAccountCannotBeUsedToSignUp() throws Exception {
		githubSignin(OCTOCAT).andExpect(status().isOk());

		postJson(API + "/user/signup",
				data(Map.of("email", "traveler@example.com", "password", MEMBER_PASSWORD, "name", "搶先")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("此 Email 已註冊，請改用原本的方式登入（例如 Google）"));
		// 只用 GitHub 的帳號沒有密碼，以密碼登入與密碼錯誤相同
		postJson(API + "/user/signin", Map.of("username", "traveler@example.com", "password", MEMBER_PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("登入失敗"));
	}

	// ───────────── 連結與解除 ─────────────

	@Test
	void memberLinksGitHubThenSignsInWithIt() throws Exception {
		String member = signupMember("member@example.com", "會員");
		String uid = read(mockMvc.perform(post(API + "/user/check").header("Authorization", member))).get("uid").asText();

		link(member, OCTOCAT)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已連結 GitHub"))
				.andExpect(jsonPath("$.profile.identities[0].provider").value("github"))
				// GitHub 的 email 可以與帳號的不同
				.andExpect(jsonPath("$.profile.identities[0].email").value("traveler@example.com"));
		// 已連結同一個帳號時不做事
		link(member, OCTOCAT).andExpect(status().isOk());

		githubSignin(OCTOCAT)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("登入成功"))
				.andExpect(jsonPath("$.uid").value(uid));
	}

	@Test
	void accountWithoutEmailCanStillBeLinked() throws Exception {
		String member = signupMember("member@example.com", "會員");

		link(member, FakeGitHub.user(10, "noemail", "No Email", null))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.profile.identities[0].provider").value("github"))
				.andExpect(jsonPath("$.profile.identities[0].email").doesNotExist());
		profile(member).andExpect(jsonPath("$.profile.identities[0].email").isEmpty());
	}

	@Test
	void gitHubAccountCanOnlyBelongToOneMemberAndMemberToOneGitHubAccount() throws Exception {
		String first = signupMember("first@example.com", "First");
		String second = signupMember("second@example.com", "Second");
		link(first, OCTOCAT).andExpect(status().isOk());

		link(second, OCTOCAT)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("這個 GitHub 帳號已連結其他會員"));
		link(first, FakeGitHub.user(2, "other", "Other", "other@example.com"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.message").value("已連結其他 GitHub 帳號，請先解除連結"));
	}

	@Test
	void identitiesAreListedInSpecOrder() throws Exception {
		String member = signupMember("member@example.com", "會員");
		link(member, OCTOCAT).andExpect(status().isOk());
		mockMvc.perform(post(API + "/user/google/link").header("Authorization", member)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("credential", GoogleTestTokens.token("google-1", "g@gmail.com", "G"))))))
				.andExpect(status().isOk());

		profile(member)
				.andExpect(jsonPath("$.profile.identities[0].provider").value("google"))
				.andExpect(jsonPath("$.profile.identities[1].provider").value("github"));
	}

	@Test
	void unlinkKeepsAtLeastOneSigninMethod() throws Exception {
		String githubOnly = githubToken(OCTOCAT);
		unlink(githubOnly, "github")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("至少要保留一種登入方式，請先設定密碼"));

		// 還有 Google 時，沒有密碼也可以解除 GitHub；之後 Google 就是唯一的方式
		mockMvc.perform(post(API + "/user/google/link").header("Authorization", githubOnly)
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(data(Map.of("credential", GoogleTestTokens.token("google-1", "g@gmail.com", "G"))))))
				.andExpect(status().isOk());
		unlink(githubOnly, "github")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已解除連結 GitHub"))
				.andExpect(jsonPath("$.profile.identities.length()").value(1))
				.andExpect(jsonPath("$.profile.identities[0].provider").value("google"));
		mockMvc.perform(delete(API + "/user/google/link").header("Authorization", githubOnly))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("至少要保留一種登入方式，請先設定密碼"));

		// 有密碼的會員可以解除；沒有連結時不做事（其他平台也一樣）
		String member = signupMember("member@example.com", "會員");
		link(member, FakeGitHub.user(2, "other", "Other", "other@example.com")).andExpect(status().isOk());
		unlink(member, "github").andExpect(status().isOk()).andExpect(jsonPath("$.profile.identities").isEmpty());
		unlink(member, "github").andExpect(status().isOk());
		unlink(member, "facebook").andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已解除連結 Facebook"));
		unlink(member, "twitter")
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到這個登入方式"));
	}

	@Test
	void linkRequiresToken() throws Exception {
		postJson(GITHUB_LINK, data(codeBody("abc"))).andExpect(status().isUnauthorized());
		mockMvc.perform(delete(GITHUB_LINK)).andExpect(status().isUnauthorized());
	}

	// ───────────── 設定密碼 ─────────────

	private static Map<String, Object> reauth(String provider, String code) {
		return Map.of("provider", provider, "code", code, "redirect_uri", FakeGitHub.REDIRECT_URI);
	}

	@Test
	void gitHubOnlyAccountSetsPasswordWithFreshAuthorization() throws Exception {
		String token = githubToken(OCTOCAT);
		Map<String, Object> body = new HashMap<>();
		body.put("new_password", "Journey2027");
		body.put("oauth", reauth("github", GITHUB.authorize(OCTOCAT)));

		JsonNode result = read(setPassword(token, body)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已設定密碼")));

		profile(token).andExpect(status().isUnauthorized()); // 既有 token 失效
		profile(result.get("token").asText()).andExpect(jsonPath("$.profile.has_password").value(true));
		postJson(API + "/user/signin", Map.of("username", "traveler@example.com", "password", "Journey2027"))
				.andExpect(status().isOk());
	}

	@Test
	void settingPasswordRequiresTheLinkedGitHubAccount() throws Exception {
		String token = githubToken(OCTOCAT);

		setPassword(token, Map.of("new_password", "Journey2027"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("請重新以已連結的登入方式驗證"));
		// 其他 GitHub 帳號、無效的 code 都不行
		for (String code : new String[] { GITHUB.authorize(FakeGitHub.user(2, "attacker", "A", "a@example.com")),
				"never-issued" }) {
			setPassword(token, Map.of("new_password", "Journey2027", "oauth", reauth("github", code)))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("GitHub 驗證失敗，請以已連結的 GitHub 帳號驗證"));
		}
		setPassword(token, Map.of("new_password", "Journey2027", "oauth", reauth("twitter", "abc")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("找不到這個登入方式"));
		setPassword(token, Map.of("new_password", "Journey2027",
				"oauth", Map.of("provider", "github", "redirect_uri", FakeGitHub.REDIRECT_URI)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("code 屬性不得為空"));
		// 沒有連結的平台不行
		setPassword(token, Map.of("new_password", "Journey2027", "oauth", Map.of("provider", "facebook",
				"code", FACEBOOK.authorize(FakeFacebook.user("fb-1", "Someone", "someone@example.com")),
				"redirect_uri", FakeFacebook.REDIRECT_URI)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("Facebook 驗證失敗，請以已連結的 Facebook 帳號驗證"));
		GITHUB.failToken(500);
		setPassword(token, Map.of("new_password", "Journey2027", "oauth", reauth("github", "abc")))
				.andExpect(status().isBadGateway());
		GITHUB.reset();

		profile(token).andExpect(jsonPath("$.profile.has_password").value(false));
	}
}
