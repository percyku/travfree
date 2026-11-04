package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.Coupon;

/** 也作為訂單快照存進 order_items.coupon_snapshot。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CouponResponse(
		String id,
		String title,
		String code,
		int percent,
		@JsonProperty("due_date") long dueDate,
		@JsonProperty("is_enabled") int isEnabled,
		Integer num) {

	public static CouponResponse from(Coupon coupon) {
		return from(coupon, null);
	}

	public static CouponResponse from(Coupon coupon, Integer num) {
		return new CouponResponse(
				coupon.getId(),
				coupon.getTitle(),
				coupon.getCode(),
				coupon.getPercent(),
				coupon.getDueDate(),
				coupon.isEnabled() ? 1 : 0,
				num);
	}
}
