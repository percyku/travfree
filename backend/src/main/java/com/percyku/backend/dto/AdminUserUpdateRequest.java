package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotNull;

public record AdminUserUpdateRequest(
		@JsonProperty("is_admin")
		@NotNull(message = "is_admin 屬性不得為空")
		Boolean isAdmin) {
}
