package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.percyku.backend.config.LegacySchemaMigration;

/** 模擬會員系統之前的資料庫（users 的單一 role 欄位、沒有 name、共用購物車的 cart_items），確認啟動時的轉換。 */
class LegacySchemaMigrationTest extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	LegacySchemaMigration migration;

	@Autowired
	PasswordEncoder passwordEncoder;

	@AfterEach
	void dropLegacyColumnIfLeft() {
		jdbc.execute("ALTER TABLE users DROP COLUMN IF EXISTS role");
	}

	private boolean hasRoleColumn() {
		return jdbc.queryForObject("""
				SELECT COUNT(*) FROM information_schema.columns
				WHERE LOWER(table_name) = 'users' AND LOWER(column_name) = 'role'
				""", Integer.class) > 0;
	}

	@Test
	void convertsLegacyRoleColumnAndFillsMissingName() throws Exception {
		jdbc.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20)");
		String id = UUID.randomUUID().toString();
		jdbc.update("""
				INSERT INTO users (id, email, password_hash, role, token_version, created_at)
				VALUES (?, ?, ?, 'ADMIN', 0, ?)
				""", id, "legacy.admin@example.com", passwordEncoder.encode("Legacy2026"),
				Timestamp.from(Instant.now()));

		migration.run(new DefaultApplicationArguments());

		assertThat(hasRoleColumn()).isFalse();
		assertThat(jdbc.queryForList("SELECT role FROM user_roles WHERE user_id = ?", String.class, id))
				.containsExactly("ADMIN");
		assertThat(jdbc.queryForObject("SELECT name FROM users WHERE id = ?", String.class, id))
				.isEqualTo("legacy.admin");

		// 轉換後的帳號可以登入後台
		postJson("/admin/signin", Map.of("username", "legacy.admin@example.com", "password", "Legacy2026"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true));
	}

	@Test
	void dropsSharedCartTable() throws Exception {
		jdbc.execute("CREATE TABLE cart_items (id VARCHAR(36) PRIMARY KEY, product_id VARCHAR(36) UNIQUE, qty INT)");
		jdbc.update("INSERT INTO cart_items (id, product_id, qty) VALUES ('legacy-line', 'legacy-product', 1)");

		migration.run(new DefaultApplicationArguments());

		assertThat(jdbc.queryForObject(
				"SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = 'cart_items'", Integer.class))
				.isZero();
		// 新的購物車照常運作
		addToCart(createProduct("東京", 1000), 1);
	}

	@Test
	void runningAgainChangesNothing() throws Exception {
		long rolesBefore = jdbc.queryForObject("SELECT COUNT(*) FROM user_roles", Long.class);

		migration.run(new DefaultApplicationArguments());
		migration.run(new DefaultApplicationArguments());

		assertThat(hasRoleColumn()).isFalse();
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_roles", Long.class)).isEqualTo(rolesBefore);
	}

	/** 階段 5 之前 password_hash 是 NOT NULL，ddl-auto=update 不會移除，只用 Google 登入的帳號就建不起來 */
	@Test
	void dropsNotNullOnPasswordHash() throws Exception {
		jdbc.execute("ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL");

		migration.run(new DefaultApplicationArguments());
		migration.run(new DefaultApplicationArguments());

		assertThat(jdbc.queryForObject("""
				SELECT is_nullable FROM information_schema.columns
				WHERE LOWER(table_name) = 'users' AND LOWER(column_name) = 'password_hash'
				""", String.class)).isEqualTo("YES");
		// 只用 Google 登入的帳號建得起來
		postJson(API + "/user/google", data(Map.of("credential",
				GoogleTestTokens.token("google-legacy", "legacy.google@gmail.com", "舊庫"))))
				.andExpect(status().isOk());
	}
}
