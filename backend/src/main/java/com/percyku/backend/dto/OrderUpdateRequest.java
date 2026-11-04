package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 前端會把整筆訂單傳回來，但後台只能改付款與外送狀態，其餘欄位一律忽略。
 * status 來自 select，是字串（"1"），由 Jackson 轉成整數。
 */
public record OrderUpdateRequest(
		@JsonProperty("is_paid") Boolean isPaid,
		@Min(value = 0, message = "status 必須介於 0 到 3")
		@Max(value = 3, message = "status 必須介於 0 到 3")
		Integer status) {
}
