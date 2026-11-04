package com.percyku.backend.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(
		String apiPath,
		String publicBaseUrl,
		String uploadDir,
		Jwt jwt,
		Admin admin,
		Cors cors) {

	public record Jwt(String secret, Duration ttl) {
	}

	public record Admin(String email, String password) {
	}

	public record Cors(List<String> allowedOrigins) {
	}
}
