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

import com.percyku.backend.config.LegacyUserSchemaMigration;

/** 模擬會員系統之前的 users 表（單一 role 欄位、沒有 name），確認啟動時的轉換。 */
class LegacyUserSchemaMigrationTest extends ApiTestSupport {

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	LegacyUserSchemaMigration migration;

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
	void runningAgainChangesNothing() throws Exception {
		long rolesBefore = jdbc.queryForObject("SELECT COUNT(*) FROM user_roles", Long.class);

		migration.run(new DefaultApplicationArguments());
		migration.run(new DefaultApplicationArguments());

		assertThat(hasRoleColumn()).isFalse();
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_roles", Long.class)).isEqualTo(rolesBefore);
	}
}
