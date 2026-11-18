package com.percyku.backend.dto;

import java.util.Comparator;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.User;
import com.percyku.backend.entity.UserIdentity;

/**
 * tel、address 未填時是空字串，前端可以直接放進表單。
 * identities 的 email 沒有時是 null（要出現在回應中），所以不套用全域的 NON_NULL。
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ProfileResponse(String email, String name, String tel, String address,
		@JsonProperty("has_password") boolean hasPassword,
		List<Identity> identities) {

	/** spec 規定的排列順序 */
	private static final List<String> PROVIDER_ORDER = List.of(UserIdentity.GOOGLE, "github", "facebook");

	public static ProfileResponse from(User user, List<UserIdentity> identities) {
		List<Identity> sorted = identities.stream()
				.sorted(Comparator.comparingInt(identity -> order(identity.getProvider())))
				.map(identity -> new Identity(identity.getProvider(), identity.getEmail()))
				.toList();
		return new ProfileResponse(user.getEmail(), user.getName(), user.getTel(), user.getAddress(),
				user.hasPassword(), sorted);
	}

	private static int order(String provider) {
		int index = PROVIDER_ORDER.indexOf(provider);
		return index < 0 ? PROVIDER_ORDER.size() : index;
	}

	/** @param email 連結當時平台提供的 email，沒有時為 null */
	@JsonInclude(JsonInclude.Include.ALWAYS)
	public record Identity(String provider, String email) {
	}
}
