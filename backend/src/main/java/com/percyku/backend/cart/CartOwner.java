package com.percyku.backend.cart;

import java.util.Locale;
import java.util.regex.Pattern;

import com.percyku.backend.exception.ApiException;

/**
 * 這次請求操作的是哪一台購物車：帶有效 token 時是帳號的購物車（userId），否則是訪客的購物車（guestId）。
 * 兩者都是 null 表示沒有購物車可以操作。由 {@link CartOwnerArgumentResolver} 建立。
 */
public record CartOwner(String userId, String guestId) {

	public static final String HEADER = "X-Cart-Id";

	/** UUID.fromString 太寬鬆（"1-1-1-1-1" 也接受），所以用固定格式比對。 */
	private static final Pattern UUID_FORMAT = Pattern
			.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

	public static CartOwner member(String userId) {
		return new CartOwner(userId, null);
	}

	public static CartOwner guest(String header) {
		return new CartOwner(null, parseGuestId(header));
	}

	/** header 沒帶時回傳 null；格式錯誤時丟出 400。 */
	public static String parseGuestId(String header) {
		if (header == null || header.isBlank()) {
			return null;
		}
		String id = header.strip().toLowerCase(Locale.ROOT);
		if (!UUID_FORMAT.matcher(id).matches()) {
			throw ApiException.badRequest(HEADER + " 格式不正確");
		}
		return id;
	}

	public boolean isMember() {
		return userId != null;
	}

	public boolean isAnonymous() {
		return userId == null && guestId == null;
	}
}
