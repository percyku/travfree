package com.percyku.backend.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

/**
 * 一台購物車，屬於一個帳號或一個訪客，user 與 guestId 剛好一個有值。
 * 訪客以前端產生的 X-Cart-Id 識別；登入後由 merge 併入帳號的購物車。
 */
@Entity
@Table(name = "carts")
public class Cart extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", unique = true)
	private User user;

	@Column(name = "guest_id", length = 36, unique = true)
	private String guestId;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected Cart() {
	}

	public static Cart forUser(User user) {
		Cart cart = new Cart();
		cart.user = user;
		return cart;
	}

	public static Cart forGuest(String guestId) {
		Cart cart = new Cart();
		cart.guestId = guestId;
		return cart;
	}

	public String getGuestId() {
		return guestId;
	}
}
