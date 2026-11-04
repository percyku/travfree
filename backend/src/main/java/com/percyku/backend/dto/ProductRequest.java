package com.percyku.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ProductRequest(
		@NotBlank(message = "title 屬性不得為空") String title,
		@NotBlank(message = "category 屬性不得為空") String category,
		@NotBlank(message = "unit 屬性不得為空") String unit,
		@JsonProperty("origin_price")
		@NotNull(message = "origin_price 屬性不得為空")
		@Min(value = 0, message = "origin_price 不得小於 0")
		Integer originPrice,
		@NotNull(message = "price 屬性不得為空")
		@Min(value = 0, message = "price 不得小於 0")
		Integer price,
		String description,
		String content,
		@JsonProperty("is_enabled")
		@Min(value = 0, message = "is_enabled 只能是 0 或 1")
		@Max(value = 1, message = "is_enabled 只能是 0 或 1")
		Integer isEnabled,
		String imageUrl,
		List<String> imagesUrl) {
}
