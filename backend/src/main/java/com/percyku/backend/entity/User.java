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

	@Column(nullable = false, unique = true, updatable = false)
	private String email;

	@Column(name = "password_hash", nullable = false)
	private String passwordHash;

	/**
	 * DDL 允許 null：ddl-auto=update 無法對已有資料的表加上 NOT NULL 欄位。
	 * 程式寫入時一定有值，舊資料由 LegacySchemaMigration 補上。
	 */
	@Column(length = NAME_MAX_LENGTH)
	private String name;

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

	public void revokeTokens() {
		tokenVersion++;
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

	public String getName() {
		return name;
	}

	/** 依 Role 的宣告順序排列，讓回應的順序固定。 */
	public Set<Role> getRoles() {
		return roles.isEmpty() ? Collections.emptySet() : Collections.unmodifiableSet(EnumSet.copyOf(roles));
	}

	public int getTokenVersion() {
		return tokenVersion;
	}
}
