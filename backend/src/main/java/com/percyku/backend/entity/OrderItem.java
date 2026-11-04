package com.percyku.backend.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.percyku.backend.dto.CouponResponse;
import com.percyku.backend.dto.LineItemResponse;
import com.percyku.backend.dto.ProductResponse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * 下單當下的快照。product_id 刻意不設外鍵，之後改價或刪除產品都不影響歷史訂單。
 */
@Entity
@Table(name = "order_items")
public class OrderItem extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false)
	private Order order;

	@Column(name = "product_id", nullable = false, length = 36)
	private String productId;

	@Column(nullable = false)
	private int qty;

	@Column(nullable = false)
	private long total;

	@Column(name = "final_total", nullable = false)
	private long finalTotal;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "product_snapshot", nullable = false)
	private ProductResponse productSnapshot;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "coupon_snapshot")
	private CouponResponse couponSnapshot;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	protected OrderItem() {
	}

	public OrderItem(Order order, LineItemResponse line, int sortOrder) {
		this.order = order;
		this.productId = line.productId();
		this.qty = line.qty();
		this.total = line.total();
		this.finalTotal = line.finalTotal();
		this.productSnapshot = line.product();
		this.couponSnapshot = line.coupon();
		this.sortOrder = sortOrder;
	}

	public String getProductId() {
		return productId;
	}

	public int getQty() {
		return qty;
	}

	public long getTotal() {
		return total;
	}

	public long getFinalTotal() {
		return finalTotal;
	}

	public ProductResponse getProductSnapshot() {
		return productSnapshot;
	}

	public CouponResponse getCouponSnapshot() {
		return couponSnapshot;
	}
}
