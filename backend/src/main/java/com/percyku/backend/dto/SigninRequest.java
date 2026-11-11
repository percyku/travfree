package com.percyku.backend.dto;

import com.percyku.backend.entity.User;

import jakarta.validation.constraints.NotBlank;

public record SigninRequest(
		@NotBlank(message = "username 屬性不得為空") String username,
		@NotBlank(message = "password 屬性不得為空") String password) {

	/** 帳號以小寫保存，登入時也轉成小寫，登入次數限制的計數才不會因大小寫分開。 */
	public SigninRequest {
		username = User.normalizeEmail(username);
	}
}
