package com.percyku.backend.entity;

import java.time.Instant;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

/** email 一律以小寫保存且不能修改；主鍵是 UUID，JWT 的 subject 與其他表的外鍵都用它。 */
@Entity
@Table(name = "users")
public class User extends BaseEntity {

	public static final int NAME_MAX_LENGTH = 30;
	public static final int TEL_MAX_LENGTH = 20;
	public static final int ADDRESS_MAX_LENGTH = 100;

	@Column(nullable = false, unique = true, updatable = false)
	private String email;

	/** 只用第三方登入的帳號沒有密碼（null）。舊資料庫的 NOT NULL 由 LegacySchemaMigration 移除。 */
	@Column(name = "password_hash")
	private String passwordHash;

	/**
	 * DDL 允許 null：ddl-auto=update 無法對已有資料的表加上 NOT NULL 欄位。
	 * 程式寫入時一定有值，舊資料由 LegacySchemaMigration 補上。
	 */
	@Column(length = NAME_MAX_LENGTH)
	private String name;

	/** 會員中心填寫，結帳時預先帶入。未填時為 null，回應時轉成空字串。 */
	@Column(length = TEL_MAX_LENGTH)
	private String tel;

	@Column(length = ADDRESS_MAX_LENGTH)
	private String address;

	/** 每次驗證 token 都會讀取角色，所以直接載入。 */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
	@Enumerated(EnumType.STRING)
	@Column(name = "role", nullable = false, length = 20)
	private Set<Role> roles = new HashSet<>();

	/** 簽進 JWT 的 ver claim；登出時遞增，讓已發出的 token 全部失效。 */
	@Column(name = "token_version", nullable = false)
	private int tokenVersion;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected User() {
	}

	public User(String email, String passwordHash, String name, Set<Role> roles) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.name = name;
		this.roles.addAll(roles);
	}

	/** 去掉前後空白並轉成小寫。註冊、登入與預設 admin 都經過這裡，所以大小寫不同的 email 視為同一個。 */
	public static String normalizeEmail(String email) {
		return email == null ? null : email.strip().toLowerCase(Locale.ROOT);
	}

	/** 沒有姓名時（舊資料、Google 沒給 name）以 email 的 @ 前面當姓名，超過上限截斷。 */
	public static String defaultName(String email) {
		int at = email.indexOf('@');
		String name = at > 0 ? email.substring(0, at) : email;
		return name.length() > NAME_MAX_LENGTH ? name.substring(0, NAME_MAX_LENGTH) : name;
	}

	public void revokeTokens() {
		tokenVersion++;
	}

	/** 升級只加上 ADMIN，保留 USER，升級後仍可結帳。 */
	public void grantAdmin() {
		roles.add(Role.ADMIN);
	}

	/** 移除 ADMIN；帳號因此沒有角色時（例如只有 ADMIN 的預設 admin）補上 USER，帳號不會沒有角色。 */
	public void revokeAdmin() {
		roles.remove(Role.ADMIN);
		if (roles.isEmpty()) {
			roles.add(Role.USER);
		}
	}

	/** 空字串的 tel、address 存成 null（未填）。 */
	public void updateProfile(String name, String tel, String address) {
		this.name = name;
		this.tel = emptyToNull(tel);
		this.address = emptyToNull(address);
	}

	/** 變更或第一次設定密碼。已發出的 token 全部失效，呼叫端要另外發新的 token 給目前的裝置。 */
	public void changePassword(String passwordHash) {
		this.passwordHash = passwordHash;
		revokeTokens();
	}

	private static String emptyToNull(String value) {
		return value == null || value.isEmpty() ? null : value;
	}

	public boolean hasRole(Role role) {
		return roles.contains(role);
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public boolean hasPassword() {
		return passwordHash != null;
	}

	public String getName() {
		return name;
	}

	public String getTel() {
		return tel == null ? "" : tel;
	}

	public String getAddress() {
		return address == null ? "" : address;
	}

	/** 依 Role 的宣告順序排列，讓回應的順序固定。 */
	public Set<Role> getRoles() {
		return roles.isEmpty() ? Collections.emptySet() : Collections.unmodifiableSet(EnumSet.copyOf(roles));
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public int getTokenVersion() {
		return tokenVersion;
	}
}
