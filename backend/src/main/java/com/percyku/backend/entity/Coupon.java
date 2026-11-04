package com.percyku.backend.entity;

import java.time.Instant;

import com.percyku.backend.dto.CouponRequest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "coupons")
public class Coupon extends BaseEntity {

	@Column(nullable = false)
	private String title;

	@Column(nullable = false, unique = true)
	private String code;

	/** 實付比例：80 代表付 80%。 */
	@Column(nullable = false)
	private int percent;

	/** 到期時間，Unix 秒。 */
	@Column(name = "due_date", nullable = false)
	private long dueDate;

	@Column(name = "is_enabled", nullable = false)
	private boolean enabled;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	public void apply(CouponRequest request) {
		title = request.title();
		code = request.code();
		percent = request.percent();
		dueDate = request.dueDate();
		enabled = request.isEnabled() != null && request.isEnabled() == 1;
	}

	public String getTitle() {
		return title;
	}

	public String getCode() {
		return code;
	}

	public int getPercent() {
		return percent;
	}

	public long getDueDate() {
		return dueDate;
	}

	public boolean isEnabled() {
		return enabled;
	}
}
