package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/**
 * @param finalTotal 選填，前端畫面顯示的總計。與購物車目前的金額不同時回 409，避免顧客在不知情下以另一個金額成交
 */
public record OrderCreateRequest(
		@NotNull(message = "user 屬性不得為空") @Valid OrderUser user,
		String message,
		@JsonProperty("final_total") Long finalTotal) {
}
