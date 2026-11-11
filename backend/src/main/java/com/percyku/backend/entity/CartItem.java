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
 * 購物車的一列，每台購物車的每個產品最多一列。金額不落地，讀取時由目前售價與優惠券算出。
 *
 * <p>表名是 cart_lines 而不是 cart_items：舊的 cart_items 屬於全站共用的購物車，product_id 有單欄唯一限制，
 * ddl-auto=update 無法移除它，也無法加上 NOT NULL 的 cart_id。舊表由 LegacySchemaMigration 移除。
 */
@Entity
@Table(name = "cart_lines", uniqueConstraints = @UniqueConstraint(columnNames = { "cart_id", "product_id" }))
public class CartItem extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "cart_id", nullable = false)
	private Cart cart;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "product_id", nullable = false)
	private Product product;

	@Column(nullable = false)
	private int qty;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "coupon_id")
	private Coupon coupon;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected CartItem() {
	}

	public CartItem(Cart cart, Product product, int qty) {
		this.cart = cart;
		this.product = product;
		this.qty = qty;
	}

	/** 合併購物車時，把訪客的品項整列移到帳號的購物車。 */
	public void moveTo(Cart target) {
		this.cart = target;
	}

	public Product getProduct() {
		return product;
	}

	public int getQty() {
		return qty;
	}

	public void setQty(int qty) {
		this.qty = qty;
	}

	public Coupon getCoupon() {
		return coupon;
	}

	public void setCoupon(Coupon coupon) {
		this.coupon = coupon;
	}
}
