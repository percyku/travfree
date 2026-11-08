package com.percyku.backend.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.mock.env.MockEnvironment;

import com.percyku.backend.BackendApplication;

class ProductionConfigCheckTest {

	private static final String STRONG_SECRET = "a-production-secret-that-is-long-enough-0123";

	private final ProductionConfigCheck check = new ProductionConfigCheck();

	/** 確認 spring.factories 有註冊，且 application-prod.properties 確實清掉了開發預設值。 */
	@Test
	void applicationRefusesToStartWithProdProfileAndNoSecrets() {
		SpringApplicationBuilder app = new SpringApplicationBuilder(BackendApplication.class)
				.profiles("prod")
				.web(WebApplicationType.NONE);

		// 命令列參數優先於環境變數，避免開發機剛好設了這些變數而影響結果
		assertThatThrownBy(() -> app.run("--JWT_SECRET=", "--DB_PASSWORD=", "--ADMIN_PASSWORD="))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("prod profile 的設定不完整")
				.hasMessageContaining("JWT_SECRET 未設定")
				.hasMessageContaining("DB_PASSWORD 未設定")
				.hasMessageContaining("ADMIN_PASSWORD 未設定");
	}

	@Test
	void devDefaultsAreAllowedWithoutProdProfile() {
		MockEnvironment env = devDefaults();

		assertThatCode(() -> check.postProcessEnvironment(env, new SpringApplication())).doesNotThrowAnyException();
	}

	@Test
	void prodRejectsMissingSecrets() {
		MockEnvironment env = new MockEnvironment()
				.withProperty("app.jwt.secret", "")
				.withProperty("spring.datasource.password", " ");
		env.setActiveProfiles("prod");

		assertThatThrownBy(() -> check.postProcessEnvironment(env, new SpringApplication()))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("JWT_SECRET 未設定")
				.hasMessageContaining("DB_PASSWORD 未設定")
				.hasMessageContaining("ADMIN_PASSWORD 未設定");
	}

	@Test
	void prodRejectsDevDefaults() {
		MockEnvironment env = devDefaults();
		env.setActiveProfiles("prod");

		assertThat(ProductionConfigCheck.check(env)).containsExactly(
				"JWT_SECRET 不可使用開發用的預設值",
				"DB_PASSWORD 不可使用開發用的預設值",
				"ADMIN_PASSWORD 不可使用開發用的預設值");
	}

	@Test
	void prodRejectsShortJwtSecret() {
		MockEnvironment env = productionValues().withProperty("app.jwt.secret", "too-short");

		assertThat(ProductionConfigCheck.check(env)).containsExactly("JWT_SECRET 至少要 32 bytes");
	}

	@Test
	void prodStartsWithAllSecretsSet() {
		MockEnvironment env = productionValues();
		env.setActiveProfiles("prod");

		assertThatCode(() -> check.postProcessEnvironment(env, new SpringApplication())).doesNotThrowAnyException();
	}

	private static MockEnvironment devDefaults() {
		return new MockEnvironment()
				.withProperty("app.jwt.secret", "dev-only-secret-change-me-in-deployment-0123456789")
				.withProperty("spring.datasource.password", "travfree")
				.withProperty("app.admin.password", "Test123456");
	}

	private static MockEnvironment productionValues() {
		return new MockEnvironment()
				.withProperty("app.jwt.secret", STRONG_SECRET)
				.withProperty("spring.datasource.password", "db-password")
				.withProperty("app.admin.password", "admin-password");
	}
}
