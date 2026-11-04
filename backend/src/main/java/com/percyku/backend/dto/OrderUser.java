package com.percyku.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record OrderUser(
		@NotBlank(message = "name 屬性不得為空") String name,
		@NotBlank(message = "email 屬性不得為空")
		@Email(message = "email 格式不正確")
		String email,
		@NotBlank(message = "tel 屬性不得為空") String tel,
		@NotBlank(message = "address 屬性不得為空") String address) {
}
