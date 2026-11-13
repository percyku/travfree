package com.percyku.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** credential 是 Google Identity Services 回傳的 ID token。 */
public record GoogleCredentialRequest(@NotBlank(message = "credential 屬性不得為空") String credential) {
}
