package com.percyku.backend.dto;

import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.Order;
import com.percyku.backend.entity.OrderItem;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderResponse(
		String id,
		@JsonProperty("create_at") long createAt,
		@JsonProperty("is_paid") boolean isPaid,
		@JsonProperty("paid_date") Long paidDate,
		String message,
		int status,
		long total,
		OrderUser user,
		Map<String, LineItemResponse> products,
		Integer num) {

	public static OrderResponse from(Order order, Integer num) {
		Map<String, LineItemResponse> products = new LinkedHashMap<>();
		for (OrderItem item : order.getItems()) {
			products.put(item.getId(), LineItemResponse.from(item));
		}
		return new OrderResponse(
				order.getId(),
				order.getCreateAt(),
				order.isPaid(),
				order.getPaidDate(),
				order.getMessage(),
				order.getStatus(),
				order.getTotal(),
				new OrderUser(order.getUserName(), order.getUserEmail(), order.getUserTel(), order.getUserAddress()),
				products,
				num);
	}
}
