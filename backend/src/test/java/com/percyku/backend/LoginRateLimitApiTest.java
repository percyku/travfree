package com.percyku.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** 預設設定：IP + 帳號 5 次、IP 總量 20 次，鎖 15 分鐘。 */
class LoginRateLimitApiTest extends ApiTestSupport {

	private static final String ADMIN = "admin@gmail.com";
	private static final String PASSWORD = "Test123456";
	private static final String LOCKED = "登入失敗次數過多，請 15 分鐘後再試";

	@Test
	void accountIsLockedAfterFiveFailuresEvenWithCorrectPassword() throws Exception {
		for (int i = 0; i < 5; i++) {
			signinFrom("10.0.0.1", ADMIN, "wrong").andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("登入失敗"));
		}

		signinFrom("10.0.0.1", ADMIN, PASSWORD)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().string("Retry-After", "900"))
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value(LOCKED));
	}

	@Test
	void lockAppliesOnlyToTheSameIpAndAccount() throws Exception {
		lockAdminFrom("10.0.0.1");

		// 攻擊者無法從別的 IP 把 admin 鎖在外面
		signinFrom("10.0.0.2", ADMIN, PASSWORD).andExpect(status().isOk());
		// 同一 IP 的其他帳號只累計到 IP 總量，還沒達到上限
		signinFrom("10.0.0.1", "other@gmail.com", "wrong").andExpect(status().isBadRequest());
	}

	@Test
	void usernameIsComparedCaseInsensitively() throws Exception {
		for (int i = 0; i < 3; i++) {
			signinFrom("10.0.0.1", ADMIN, "wrong").andExpect(status().isBadRequest());
		}
		for (int i = 0; i < 2; i++) {
			signinFrom("10.0.0.1", " ADMIN@Gmail.com ", "wrong").andExpect(status().isBadRequest());
		}

		signinFrom("10.0.0.1", ADMIN, PASSWORD).andExpect(status().isTooManyRequests());
	}

	@Test
	void ipIsLockedAfterTwentyFailuresAcrossAccounts() throws Exception {
		for (int i = 0; i < 20; i++) {
			signinFrom("10.0.0.3", "user" + i + "@gmail.com", "wrong").andExpect(status().isBadRequest());
		}

		signinFrom("10.0.0.3", ADMIN, PASSWORD)
				.andExpect(status().isTooManyRequests())
				.andExpect(header().string("Retry-After", "900"))
				.andExpect(jsonPath("$.message").value(LOCKED));
		signinFrom("10.0.0.4", ADMIN, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void successfulSigninResetsAccountFailures() throws Exception {
		for (int i = 0; i < 4; i++) {
			signinFrom("10.0.0.1", ADMIN, "wrong").andExpect(status().isBadRequest());
		}
		signinFrom("10.0.0.1", ADMIN, PASSWORD).andExpect(status().isOk());
		for (int i = 0; i < 4; i++) {
			signinFrom("10.0.0.1", ADMIN, "wrong").andExpect(status().isBadRequest());
		}

		signinFrom("10.0.0.1", ADMIN, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void validationErrorsAreNotCounted() throws Exception {
		for (int i = 0; i < 6; i++) {
			signinFrom("10.0.0.1", ADMIN, "").andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.message").value("password 屬性不得為空"));
		}

		signinFrom("10.0.0.1", ADMIN, PASSWORD).andExpect(status().isOk());
	}

	private void lockAdminFrom(String ip) throws Exception {
		for (int i = 0; i < 5; i++) {
			signinFrom(ip, ADMIN, "wrong").andExpect(status().isBadRequest());
		}
		signinFrom(ip, ADMIN, PASSWORD).andExpect(status().isTooManyRequests());
	}

	private ResultActions signinFrom(String ip, String username, String password) throws Exception {
		return mockMvc.perform(post("/admin/signin")
				.with(request -> {
					request.setRemoteAddr(ip);
					return request;
				})
				.contentType(MediaType.APPLICATION_JSON)
				.content(json(Map.of("username", username, "password", password))));
	}
}
