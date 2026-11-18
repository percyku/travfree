package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;

/**
 * 平台導回時帶的 code。redirect_uri 必須與導向授權頁時相同，後端原樣交給平台換 token；
 * code_verifier 是 PKCE（GitHub），導向時有帶 code_challenge 就必須帶。
 */
public record OAuthCodeRequest(
		@NotBlank(message = "code 屬性不得為空") String code,
		@JsonProperty("redirect_uri") @NotBlank(message = "redirect_uri 屬性不得為空") String redirectUri,
		@JsonProperty("code_verifier") String codeVerifier) {
}
