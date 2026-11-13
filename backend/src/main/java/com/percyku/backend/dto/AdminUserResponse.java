package com.percyku.backend.dto;

import java.util.Set;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.Role;
import com.percyku.backend.entity.User;

/** 後台會員列表的一筆。create_at 是 Unix 秒，與訂單相同。 */
public record AdminUserResponse(String id, String email, String name, Set<Role> roles,
		@JsonProperty("create_at") long createAt) {

	public static AdminUserResponse from(User user) {
		return new AdminUserResponse(user.getId(), user.getEmail(), user.getName(), user.getRoles(),
				user.getCreatedAt().getEpochSecond());
	}
}
