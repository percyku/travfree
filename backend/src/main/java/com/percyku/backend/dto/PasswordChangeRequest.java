package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

/**
 * 新密碼的規則與註冊相同，見 SignupRequest。
 * 有密碼的帳號要帶 password；沒有密碼的帳號（只用第三方登入）改帶 credential（Google）或 oauth（GitHub、Facebook），
 * 由 AuthService 依帳號檢查。
 */
public record PasswordChangeRequest(
		String password,
		String credential,
		OAuthReauth oauth,
		@JsonProperty("new_password")
		@NotEmpty(message = "new_password 屬性不得為空")
		@Pattern(regexp = "^$|^(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,64}$", message = SignupRequest.PASSWORD_RULE)
		String newPassword) {

	/** 重新以已連結的平台授權取得的 code，欄位的檢查在 AuthService，訊息與 OAuthCodeRequest 相同。 */
	public record OAuthReauth(
			String provider,
			String code,
			@JsonProperty("redirect_uri") String redirectUri,
			@JsonProperty("code_verifier") String codeVerifier) {
	}
}
