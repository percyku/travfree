package com.percyku.backend.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * 帳號連結的第三方登入。以平台的帳號 ID（subject，Google 的 sub）辨識，不用 email：
 * email 會變、可能未驗證，所以只在建立新帳號時使用。email 相同也不自動合併，見 docs/FEATURES.md。
 */
@Entity
@Table(name = "user_identities", uniqueConstraints = {
		@UniqueConstraint(name = "uk_user_identities_provider_subject", columnNames = { "provider", "subject" }),
		@UniqueConstraint(name = "uk_user_identities_user_provider", columnNames = { "user_id", "provider" }) })
public class UserIdentity extends BaseEntity {

	public static final String GOOGLE = "google";

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, length = 20)
	private String provider;

	@Column(nullable = false)
	private String subject;

	/** 連結當時平台回傳的 email，只用來顯示，可以與帳號的 email 不同。 */
	@Column
	private String email;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected UserIdentity() {
	}

	public UserIdentity(User user, String provider, String subject, String email) {
		this.user = user;
		this.provider = provider;
		this.subject = subject;
		this.email = email;
	}

	public User getUser() {
		return user;
	}

	public String getProvider() {
		return provider;
	}

	public String getSubject() {
		return subject;
	}

	public String getEmail() {
		return email;
	}
}
