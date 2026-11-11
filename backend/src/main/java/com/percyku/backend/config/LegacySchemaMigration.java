package com.percyku.backend.config;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.entity.User;

/**
 * 把會員系統之前的資料庫轉成新的格式。ddl-auto=update 只會新增表與欄位，不會搬資料、刪欄位或刪表：
 *
 * <ul>
 * <li>單一的 users.role 欄位複製到 user_roles 後移除。不移除的話，新帳號寫入時會違反它的 NOT NULL。</li>
 * <li>沒有 name 的帳號以 email 的 @ 前面當姓名。</li>
 * <li>移除全站共用購物車的 cart_items 表。裡面的品項沒有擁有者，無法分給任何購物車，直接捨棄；
 * 新的品項存在 cart_lines。</li>
 * </ul>
 *
 * 每次啟動都會檢查，已轉換過就不做事，所以還原舊備份後重新啟動也會轉換。
 */
@Component
@Order(0)
public class LegacySchemaMigration implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(LegacySchemaMigration.class);

	private final JdbcTemplate jdbc;

	public LegacySchemaMigration(JdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (hasLegacyRoleColumn()) {
			int copied = jdbc.update("""
					INSERT INTO user_roles (user_id, role)
					SELECT u.id, u.role FROM users u
					WHERE u.role IS NOT NULL
					  AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = u.role)
					""");
			jdbc.execute("ALTER TABLE users DROP COLUMN role");
			log.info("已將 users.role 轉換為 user_roles（{} 筆），並移除 users.role", copied);
		}
		if (tableExists("cart_items")) {
			Integer lines = jdbc.queryForObject("SELECT COUNT(*) FROM cart_items", Integer.class);
			jdbc.execute("DROP TABLE cart_items");
			log.info("已移除全站共用購物車的 cart_items 表（捨棄 {} 筆品項）", lines);
		}
		List<Map<String, Object>> unnamed = jdbc.queryForList("SELECT id, email FROM users WHERE name IS NULL");
		for (Map<String, Object> row : unnamed) {
			jdbc.update("UPDATE users SET name = ? WHERE id = ?", defaultName((String) row.get("email")), row.get("id"));
		}
		if (!unnamed.isEmpty()) {
			log.info("已為 {} 個沒有姓名的帳號補上姓名", unnamed.size());
		}
	}

	private boolean hasLegacyRoleColumn() {
		Integer count = jdbc.queryForObject("""
				SELECT COUNT(*) FROM information_schema.columns
				WHERE LOWER(table_name) = 'users' AND LOWER(column_name) = 'role'
				""", Integer.class);
		return count != null && count > 0;
	}

	private boolean tableExists(String table) {
		Integer count = jdbc.queryForObject(
				"SELECT COUNT(*) FROM information_schema.tables WHERE LOWER(table_name) = ?", Integer.class, table);
		return count != null && count > 0;
	}

	static String defaultName(String email) {
		int at = email.indexOf('@');
		String name = at > 0 ? email.substring(0, at) : email;
		return name.length() > User.NAME_MAX_LENGTH ? name.substring(0, User.NAME_MAX_LENGTH) : name;
	}
}
