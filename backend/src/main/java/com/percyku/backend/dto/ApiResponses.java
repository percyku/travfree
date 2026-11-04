package com.percyku.backend.dto;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 組出 Hexschool 風格的回應。回應的 key 依端點而異（products、articles…），
 * 所以用 LinkedHashMap 而不是為每支 API 各寫一個外層 record；null 值也要保留（例如 order:null）。
 */
public final class ApiResponses {

	private ApiResponses() {
	}

	public static Map<String, Object> failure(String message) {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("success", false);
		body.put("message", message);
		return body;
	}

	public static Map<String, Object> message(String message) {
		Map<String, Object> body = success();
		body.put("message", message);
		return body;
	}

	public static Map<String, Object> message(String message, String key, Object value) {
		Map<String, Object> body = message(message);
		body.put(key, value);
		return body;
	}

	public static Map<String, Object> of(String key, Object value) {
		Map<String, Object> body = success();
		body.put(key, value);
		return body;
	}

	public static Map<String, Object> withMessages(String key, Object value) {
		Map<String, Object> body = of(key, value);
		body.put("messages", List.of());
		return body;
	}

	public static Map<String, Object> page(String key, PagedResult<?> result) {
		Map<String, Object> body = of(key, result.items());
		body.put("pagination", result.pagination());
		return body;
	}

	public static Map<String, Object> pageWithMessages(String key, PagedResult<?> result) {
		Map<String, Object> body = page(key, result);
		body.put("messages", List.of());
		return body;
	}

	private static Map<String, Object> success() {
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("success", true);
		return body;
	}
}
