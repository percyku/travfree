package com.percyku.backend.dto;

import com.percyku.backend.entity.User;

/** tel、address 未填時是空字串，前端可以直接放進表單。 */
public record ProfileResponse(String email, String name, String tel, String address) {

	public static ProfileResponse from(User user) {
		return new ProfileResponse(user.getEmail(), user.getName(), user.getTel(), user.getAddress());
	}
}
