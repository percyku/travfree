package com.percyku.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record CouponApplyRequest(@NotBlank(message = "code 屬性不得為空") String code) {
}
