package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.service.MemberAdminService;

/** 後台會員列表、設定與移除管理者，以及管理者不能修改自己的訂單。 */
class MemberAdminApiTest extends ApiTestSupport {

	private static final String USERS = API + "/admin/users";

	@Autowired
	MemberAdminService memberAdminService;

	@Autowired
	PasswordEncoder passwordEncoder;

	@Autowired
	JdbcTemplate jdbc;

	private String idOf(String email) {
		return userRepository.findByEmail(email).orElseThrow().getId();
	}

	private ResultActions setAdmin(String asToken, String userId, Object isAdmin) throws Exception {
		Map<String, Object> body = new HashMap<>();
		body.put("is_admin", isAdmin);
		return mockMvc.perform(put(API + "/admin/user/" + userId).header("Authorization", asToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(body))));
	}

	private ResultActions listUsers(String asToken, String query) throws Exception {
		return mockMvc.perform(get(USERS + query).header("Authorization", asToken));
	}

	private ResultActions searchUsers(String keyword) throws Exception {
		return mockMvc.perform(get(USERS).param("q", keyword).header("Authorization", token));
	}

	/** 只有 ADMIN 的帳號（像預設 admin），註冊 API 建立不出來，直接寫入資料庫 */
	private String createPureAdmin(String email) throws Exception {
		userRepository.save(new User(email, passwordEncoder.encode(MEMBER_PASSWORD), "純管理者", Set.of(Role.ADMIN)));
		return read(postJson("/admin/signin", Map.of("username", email, "password", MEMBER_PASSWORD))
				.andExpect(status().isOk())).get("token").asText();
	}

	// ───────────── 會員列表 ─────────────

	@Test
	void listsAllAccountsNewestFirstWithRoles() throws Exception {
		signupMember("alice@example.com", "Alice");
		signupMember("bob@example.com", "Bob");

		JsonNode body = read(listUsers(token, "")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.users[*].email", contains("bob@example.com", "alice@example.com", ADMIN_EMAIL)))
				.andExpect(jsonPath("$.users[0].name").value("Bob"))
				.andExpect(jsonPath("$.users[0].roles", contains("USER")))
				.andExpect(jsonPath("$.users[2].roles", contains("ADMIN")))
				.andExpect(jsonPath("$.pagination.current_page").value(1))
				.andExpect(jsonPath("$.pagination.total_pages").value(1)));
		long createAt = body.at("/users/0/create_at").asLong();
		// 秒，不是毫秒
		assertThat(createAt).isBetween(System.currentTimeMillis() / 1000 - 60, System.currentTimeMillis() / 1000 + 1);
	}

	@Test
	void listIsPagedByTen() throws Exception {
		for (int i = 0; i < 10; i++) {
			signupMember("member" + i + "@example.com", "會員" + i);
		}

		listUsers(token, "?page=2")
				.andExpect(jsonPath("$.users", hasSize(1)))
				.andExpect(jsonPath("$.users[0].email").value(ADMIN_EMAIL))
				.andExpect(jsonPath("$.pagination.total_pages").value(2))
				.andExpect(jsonPath("$.pagination.has_pre").value(true));
		listUsers(token, "?page=99").andExpect(jsonPath("$.pagination.current_page").value(2));
	}

	@Test
	void searchMatchesEmailOrNameIgnoringCase() throws Exception {
		signupMember("traveler@example.com", "王小明");
		signupMember("bob@example.com", "Traveling Bob");
		signupMember("carol@example.com", "Carol");

		searchUsers(" TRAVEL ")
				.andExpect(jsonPath("$.users[*].email", contains("bob@example.com", "traveler@example.com")));
		searchUsers("小明").andExpect(jsonPath("$.users[*].email", contains("traveler@example.com")));
		searchUsers("nobody")
				.andExpect(jsonPath("$.users", hasSize(0)))
				.andExpect(jsonPath("$.pagination.current_page").value(0));
		// % 與 _ 只當成一般字元
		searchUsers("%").andExpect(jsonPath("$.users", hasSize(0)));
		searchUsers("   ").andExpect(jsonPath("$.users", hasSize(4)));
	}

	@Test
	void membersCannotUseAdminUserApis() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");

		listUsers(member, "").andExpect(status().isForbidden());
		setAdmin(member, idOf("traveler@example.com"), true).andExpect(status().isForbidden());
		mockMvc.perform(get(USERS)).andExpect(status().isUnauthorized());
		assertThat(userRepository.findByEmail("traveler@example.com").orElseThrow().hasRole(Role.ADMIN)).isFalse();
	}

	// ───────────── 設定與移除管理者 ─────────────

	@Test
	void promotedMemberKeepsUserRoleAndCanEnterAdminImmediately() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		String id = idOf("traveler@example.com");
		listUsers(member, "").andExpect(status().isForbidden());

		setAdmin(token, id, true)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.message").value("已更新會員權限"))
				.andExpect(jsonPath("$.user.id").value(id))
				.andExpect(jsonPath("$.user.roles", contains("USER", "ADMIN")));

		// 原本的 token 不用重新登入就有權限
		listUsers(member, "").andExpect(status().isOk());
		mockMvc.perform(post(API + "/user/check").header("Authorization", member))
				.andExpect(jsonPath("$.roles", contains("USER", "ADMIN")));
		// 再設定一次不做事
		setAdmin(token, id, true).andExpect(jsonPath("$.user.roles", contains("USER", "ADMIN")));
	}

	@Test
	void demotedAdminLosesAccessImmediately() throws Exception {
		String member = signupMember("traveler@example.com", "王小明");
		String id = idOf("traveler@example.com");
		setAdmin(token, id, true);

		setAdmin(token, id, false)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.roles", contains("USER")));
		listUsers(member, "").andExpect(status().isForbidden());
		// 不是管理者時移除也不做事
		setAdmin(token, id, false).andExpect(status().isOk()).andExpect(jsonPath("$.user.roles", contains("USER")));
	}

	@Test
	void demotingPureAdminLeavesUserRole() throws Exception {
		createPureAdmin("ops@example.com");

		setAdmin(token, idOf("ops@example.com"), false)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.user.roles", contains("USER")));
	}

	@Test
	void cannotDemoteYourself() throws Exception {
		String other = createPureAdmin("ops@example.com");

		setAdmin(token, idOf(ADMIN_EMAIL), false)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("不能移除自己的管理者權限"));
		setAdmin(other, idOf("ops@example.com"), false)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("不能移除自己的管理者權限"));
		assertThat(userRepository.findByEmail(ADMIN_EMAIL).orElseThrow().hasRole(Role.ADMIN)).isTrue();
		// 設定自己為管理者沒有問題（本來就是）
		setAdmin(token, idOf(ADMIN_EMAIL), true).andExpect(status().isOk());
	}

	/** 循序呼叫時遇不到（不能降級自己），以非管理者的呼叫者直接呼叫 service 模擬兩位管理者同時互相移除後的狀態 */
	@Test
	void keepsAtLeastOneAdmin() {
		String adminId = idOf(ADMIN_EMAIL);

		assertThatThrownBy(() -> memberAdminService.setAdmin("someone-else", adminId, false))
				.isInstanceOf(ApiException.class)
				.hasMessage("至少要保留一位管理者");
		assertThat(userRepository.findByEmail(ADMIN_EMAIL).orElseThrow().hasRole(Role.ADMIN)).isTrue();
	}

	@Test
	void setAdminValidatesInput() throws Exception {
		signupMember("traveler@example.com", "王小明");

		setAdmin(token, "00000000-0000-0000-0000-000000000000", true)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.message").value("找不到會員"));
		setAdmin(token, idOf("traveler@example.com"), null)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("is_admin 屬性不得為空"));
		setAdmin(token, idOf("traveler@example.com"), "yes")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("資料格式不正確"));
	}

	// ───────────── 不能修改自己的訂單 ─────────────

	@Test
	void adminCannotUpdateOrDeleteOwnOrder() throws Exception {
		String productId = createProduct("東京", 1000);
		// 會員升級為管理者後自己下單
		shopperToken = signupMember("staff@example.com", "員工");
		String staffId = idOf("staff@example.com");
		setAdmin(token, staffId, true);
		addToCart(productId, 1);
		String ownOrder = checkout();

		mockMvc.perform(put(API + "/admin/order/" + ownOrder).header("Authorization", shopperToken)
				.contentType(MediaType.APPLICATION_JSON).content(json(data(Map.of("is_paid", true)))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("不能修改自己的訂單"));
		mockMvc.perform(delete(API + "/admin/order/" + ownOrder).header("Authorization", shopperToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("不能修改自己的訂單"));
		mockMvc.perform(delete(API + "/admin/orders/all").header("Authorization", shopperToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.message").value("不能修改自己的訂單"));
		adminGet(API + "/admin/orders")
				.andExpect(jsonPath("$.orders", hasSize(1)))
				.andExpect(jsonPath("$.orders[0].is_paid").value(false));

		// 其他管理者可以修改
		adminPut(API + "/admin/order/" + ownOrder, data(Map.of("is_paid", true))).andExpect(status().isOk());
	}

	@Test
	void adminCanUpdateOthersAndLegacyOrders() throws Exception {
		String productId = createProduct("東京", 1000);
		shopperToken = signupMember("buyer@example.com", "買家");
		addToCart(productId, 1);
		String othersOrder = checkout();
		addToCart(productId, 1);
		String legacyOrder = checkout();
		// 會員系統之前的訂單沒有下單帳號
		jdbc.update("UPDATE orders SET user_id = NULL WHERE id = ?", legacyOrder);

		// 員工（升級的會員）可以修改別人的與舊訂單
		String staff = signupMember("staff@example.com", "員工");
		setAdmin(token, idOf("staff@example.com"), true);
		for (String orderId : new String[] { othersOrder, legacyOrder }) {
			mockMvc.perform(put(API + "/admin/order/" + orderId).header("Authorization", staff)
					.contentType(MediaType.APPLICATION_JSON).content(json(data(Map.of("status", 2)))))
					.andExpect(status().isOk());
		}
		mockMvc.perform(delete(API + "/admin/orders/all").header("Authorization", staff))
				.andExpect(status().isOk());
		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders", hasSize(0)));
	}

	@Test
	void orderBuyerIdOnlyAppearsInAdminLists() throws Exception {
		String productId = createProduct("東京", 1000);
		shopperToken = signupMember("buyer@example.com", "買家");
		addToCart(productId, 1);
		String orderId = checkout();
		String buyerId = idOf("buyer@example.com");

		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders[0].user_id").value(buyerId));
		adminGet(API + "/orders").andExpect(jsonPath("$.orders[0].user_id").value(buyerId));
		mockMvc.perform(get(API + "/order/" + orderId))
				.andExpect(jsonPath("$.order.id").value(orderId))
				.andExpect(jsonPath("$.order.user_id").doesNotExist());

		jdbc.update("UPDATE orders SET user_id = NULL WHERE id = ?", orderId);
		adminGet(API + "/admin/orders").andExpect(jsonPath("$.orders[0].user_id").doesNotExist());
	}
}
