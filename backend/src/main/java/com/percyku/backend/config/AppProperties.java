package com.percyku.backend.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
		String publicBaseUrl,
		String uploadDir,
		Jwt jwt,
		Admin admin,
		Cors cors,
		LoginLimit loginLimit) {

	public record Jwt(String secret, Duration ttl) {
	}

	public record Admin(String email, String password) {
	}

	public record Cors(List<String> allowedOrigins) {
	}

	/**
	 * 登入失敗次數限制。兩種計數在 window 內各自累計，任一種達到上限就鎖 lockout。
	 *
	 * @param maxFailuresPerAccount 同一 IP 對同一帳號的失敗上限，登入成功會歸零
	 * @param maxFailuresPerIp 同一 IP 不分帳號的失敗上限
	 */
	public record LoginLimit(int maxFailuresPerAccount, int maxFailuresPerIp, Duration window, Duration lockout) {
	}
}
