package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

/**
 * 新密碼的規則與註冊相同，見 SignupRequest。
 * 有密碼的帳號要帶 password；沒有密碼的帳號（只用 Google 登入）改帶 credential，兩者由 AuthService 依帳號檢查。
 */
public record PasswordChangeRequest(
		String password,
		String credential,
		@JsonProperty("new_password")
		@NotEmpty(message = "new_password 屬性不得為空")
		@Pattern(regexp = "^$|^(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,64}$", message = SignupRequest.PASSWORD_RULE)
		String newPassword) {
}
