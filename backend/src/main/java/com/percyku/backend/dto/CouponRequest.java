package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CouponRequest(
		@NotBlank(message = "title 屬性不得為空") String title,
		@NotBlank(message = "code 屬性不得為空") String code,
		@NotNull(message = "percent 屬性不得為空")
		@Min(value = 0, message = "percent 必須介於 0 到 100")
		@Max(value = 100, message = "percent 必須介於 0 到 100")
		Integer percent,
		@JsonProperty("due_date")
		@NotNull(message = "due_date 屬性不得為空")
		Long dueDate,
		@JsonProperty("is_enabled")
		@Min(value = 0, message = "is_enabled 只能是 0 或 1")
		@Max(value = 1, message = "is_enabled 只能是 0 或 1")
		Integer isEnabled) {
}
