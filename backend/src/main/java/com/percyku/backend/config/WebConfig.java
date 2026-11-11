package com.percyku.backend.config;

import java.nio.file.Path;
import java.util.List;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.percyku.backend.cart.CartOwnerArgumentResolver;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class WebConfig implements WebMvcConfigurer {

	private final AppProperties properties;
	private final CartOwnerArgumentResolver cartOwnerResolver;

	public WebConfig(AppProperties properties, CartOwnerArgumentResolver cartOwnerResolver) {
		this.properties = properties;
		this.cartOwnerResolver = cartOwnerResolver;
	}

	@Override
	public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
		resolvers.add(cartOwnerResolver);
	}

	@Override
	public void addResourceHandlers(ResourceHandlerRegistry registry) {
		String location = Path.of(properties.uploadDir()).toAbsolutePath().normalize().toUri().toString();
		registry.addResourceHandler("/uploads/**")
				.addResourceLocations(location.endsWith("/") ? location : location + "/");
	}
}
