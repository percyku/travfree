package com.percyku.backend;

import static com.atlassian.oai.validator.mockmvc.OpenApiValidationMatchers.openApi;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.report.LevelResolver;
import com.atlassian.oai.validator.report.ValidationReport;

/**
 * 讓所有 MockMvc 測試的回應都對 docs/openapi.yaml 驗證，spec 是前後端的契約。
 * 只驗證回應：測試會刻意送出錯誤的請求來測錯誤情境。
 */
@TestConfiguration(proxyBeanMethods = false)
class OpenApiContractConfig {

	static final Path SPEC = Path.of("..", "docs", "openapi.yaml").toAbsolutePath().normalize();

	@Bean
	MockMvcBuilderCustomizer openApiContract() {
		if (!Files.exists(SPEC)) {
			throw new IllegalStateException("找不到 OpenAPI spec：" + SPEC);
		}
		OpenApiInteractionValidator validator = OpenApiInteractionValidator
				.createForSpecificationUrl(SPEC.toUri().toString())
				// MockMvc 不經過 context-path，spec 的 server 是 /v2
				.withBasePathOverride("/")
				.withLevelResolver(LevelResolver.create()
						.withLevel("validation.request", ValidationReport.Level.IGNORE)
						.build())
				.build();
		return builder -> builder.alwaysExpect(openApi().isValid(validator));
	}
}
