package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CartRequest(
		@JsonProperty("product_id")
		@NotBlank(message = "product_id 屬性不得為空")
		String productId,
		@NotNull(message = "qty 屬性不得為空")
		@Min(value = 1, message = "qty 不得小於 1")
		@Max(value = CartRequest.MAX_QTY, message = "qty 不得大於 " + CartRequest.MAX_QTY)
		Integer qty) {

	public static final int MAX_QTY = 9999;
}
