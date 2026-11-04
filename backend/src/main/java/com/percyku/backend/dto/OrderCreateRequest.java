package com.percyku.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record OrderCreateRequest(
		@NotNull(message = "user 屬性不得為空") @Valid OrderUser user,
		String message) {
}
