package com.percyku.backend.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * prod profile 下，密鑰與密碼沒設定或沿用開發預設值時拒絕啟動。
 * 用 EnvironmentPostProcessor 是為了在連線資料庫之前就檢查，否則會先看到難懂的連線錯誤。
 * 在 META-INF/spring.factories 註冊。
 */
public class ProductionConfigCheck implements EnvironmentPostProcessor {

	static final String PROD_PROFILE = "prod";

	/** JJWT 的 HS256 要求至少 256 bits。 */
	static final int MIN_JWT_SECRET_BYTES = 32;

	/** 每一項都要與 application.properties 的開發預設值一致。 */
	private static final List<Secret> SECRETS = List.of(
			new Secret("app.jwt.secret", "JWT_SECRET", "dev-only-secret-change-me-in-deployment-0123456789"),
			new Secret("spring.datasource.password", "DB_PASSWORD", "travfree"),
			new Secret("app.admin.password", "ADMIN_PASSWORD", "Test123456"));

	@Override
	public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
		if (!environment.acceptsProfiles(Profiles.of(PROD_PROFILE))) {
			return;
		}
		List<String> problems = check(environment);
		if (!problems.isEmpty()) {
			throw new IllegalStateException("prod profile 的設定不完整，拒絕啟動：\n  - " + String.join("\n  - ", problems));
		}
	}

	static List<String> check(Environment environment) {
		List<String> problems = new ArrayList<>();
		for (Secret secret : SECRETS) {
			String value = environment.getProperty(secret.property());
			if (value == null || value.isBlank()) {
				problems.add(secret.envVar() + " 未設定");
			} else if (Objects.equals(value, secret.devDefault())) {
				problems.add(secret.envVar() + " 不可使用開發用的預設值");
			}
		}
		String jwtSecret = environment.getProperty("app.jwt.secret");
		if (jwtSecret != null && !jwtSecret.isBlank()
				&& jwtSecret.getBytes(StandardCharsets.UTF_8).length < MIN_JWT_SECRET_BYTES) {
			problems.add("JWT_SECRET 至少要 " + MIN_JWT_SECRET_BYTES + " bytes");
		}
		return problems;
	}

	private record Secret(String property, String envVar, String devDefault) {
	}
}
