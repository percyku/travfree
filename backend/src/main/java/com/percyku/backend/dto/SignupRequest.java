package com.percyku.backend.dto;

import com.percyku.backend.entity.User;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 格式的 pattern 都允許空字串，讓空白欄位只出現「不得為空」一則訊息。
 * 密碼限制為 ASCII：bcrypt 只處理前 72 bytes，多位元組字元會讓長度限制失去意義。
 */
public record SignupRequest(
		@NotBlank(message = "email 屬性不得為空")
		@Size(max = 254, message = "email 格式不正確")
		@Pattern(regexp = "^$|^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$", message = "email 格式不正確")
		String email,
		@NotEmpty(message = "password 屬性不得為空")
		@Pattern(regexp = "^$|^(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,64}$", message = PASSWORD_RULE)
		String password,
		@NotBlank(message = "name 屬性不得為空")
		@Size(max = User.NAME_MAX_LENGTH, message = "name 不得超過 " + User.NAME_MAX_LENGTH + " 個字")
		String name) {

	public static final String PASSWORD_RULE = "密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字";

	public SignupRequest {
		email = User.normalizeEmail(email);
		name = name == null ? null : name.strip();
	}
}
