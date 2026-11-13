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
		LoginLimit loginLimit,
		Google google) {

	public record Jwt(String secret, Duration ttl) {
	}

	public record Admin(String email, String password) {
	}

	public record Cors(List<String> allowedOrigins) {
	}

	/**
	 * Google 登入。clientId 空白時關閉。
	 *
	 * @param testPublicKey 只給 E2E 使用：設定時以這把 RSA 公鑰（PEM 或 base64 的 X.509）驗證 ID token，不連 Google
	 */
	public record Google(String clientId, String testPublicKey) {
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
