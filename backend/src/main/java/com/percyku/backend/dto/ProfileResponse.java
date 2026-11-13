package com.percyku.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.User;
import com.percyku.backend.entity.UserIdentity;

/**
 * tel、address 未填時是空字串，前端可以直接放進表單。
 * google_email 未連結時是 null（要出現在回應中），所以不套用全域的 NON_NULL。
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ProfileResponse(String email, String name, String tel, String address,
		@JsonProperty("has_password") boolean hasPassword,
		@JsonProperty("google_email") String googleEmail) {

	/** @param google 已連結的 Google，沒有時為 null */
	public static ProfileResponse from(User user, UserIdentity google) {
		return new ProfileResponse(user.getEmail(), user.getName(), user.getTel(), user.getAddress(),
				user.hasPassword(), google == null ? null : google.getEmail());
	}
}
