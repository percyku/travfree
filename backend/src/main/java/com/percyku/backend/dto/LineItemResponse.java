package com.percyku.backend.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.CartItem;
import com.percyku.backend.entity.Coupon;
import com.percyku.backend.entity.OrderItem;

/** 購物車與訂單共用的品項格式。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LineItemResponse(
		String id,
		@JsonProperty("product_id") String productId,
		int qty,
		long total,
		@JsonProperty("final_total") long finalTotal,
		CouponResponse coupon,
		ProductResponse product) {

	public static LineItemResponse from(CartItem item) {
		long total = (long) item.getProduct().getPrice() * item.getQty();
		// 已停用或過期的優惠券不計折扣也不回傳；品項上的引用保留，重新啟用後恢復
		Coupon coupon = item.getCoupon();
		if (coupon != null && !coupon.isUsableAt(Instant.now().getEpochSecond())) {
			coupon = null;
		}
		return new LineItemResponse(
				item.getId(),
				item.getProduct().getId(),
				item.getQty(),
				total,
				coupon == null ? total : Math.round(total * coupon.getPercent() / 100.0),
				coupon == null ? null : CouponResponse.from(coupon),
				ProductResponse.from(item.getProduct()));
	}

	public static LineItemResponse from(OrderItem item) {
		return new LineItemResponse(
				item.getId(),
				item.getProductId(),
				item.getQty(),
				item.getTotal(),
				item.getFinalTotal(),
				item.getCouponSnapshot(),
				item.getProductSnapshot());
	}
}
