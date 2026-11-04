package com.percyku.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CartSummary(
		List<LineItemResponse> carts,
		long total,
		@JsonProperty("final_total") long finalTotal) {

	public static CartSummary of(List<LineItemResponse> lines) {
		return new CartSummary(
				lines,
				lines.stream().mapToLong(LineItemResponse::total).sum(),
				lines.stream().mapToLong(LineItemResponse::finalTotal).sum());
	}
}
