package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PaginationDto(
		@JsonProperty("total_pages") int totalPages,
		@JsonProperty("current_page") int currentPage,
		@JsonProperty("has_pre") boolean hasPre,
		@JsonProperty("has_next") boolean hasNext,
		String category) {
}
