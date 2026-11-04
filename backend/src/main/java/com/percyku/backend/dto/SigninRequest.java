package com.percyku.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record SigninRequest(
		@NotBlank(message = "username 屬性不得為空") String username,
		@NotBlank(message = "password 屬性不得為空") String password) {
}
