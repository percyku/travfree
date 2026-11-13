package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

/** 新密碼的規則與註冊相同，見 SignupRequest。 */
public record PasswordChangeRequest(
		@NotEmpty(message = "password 屬性不得為空")
		String password,
		@JsonProperty("new_password")
		@NotEmpty(message = "new_password 屬性不得為空")
		@Pattern(regexp = "^$|^(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,64}$", message = SignupRequest.PASSWORD_RULE)
		String newPassword) {
}
