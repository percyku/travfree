package com.percyku.backend.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.percyku.backend.cart.CartOwner;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.JsonSecurityErrorHandler;
import com.percyku.backend.security.JwtAuthenticationFilter;
import com.percyku.backend.security.JwtService;

@Configuration
public class SecurityConfig {

	private static final String ADMIN = "ADMIN";

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, UserRepository userRepository,
			JsonSecurityErrorHandler errorHandler) throws Exception {
		http
				.cors(Customizer.withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				// 預設的 LogoutFilter 會攔截 POST /logout，登出由 AuthController 處理
				.logout(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(handling -> handling
						.authenticationEntryPoint(errorHandler)
						.accessDeniedHandler(errorHandler))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers("/api/user/check", "/api/cart/merge").authenticated()
						// 結帳需要一般會員；只有 ADMIN 的帳號（例如預設 admin）不能結帳
						.requestMatchers(HttpMethod.POST, "/api/order").hasRole("USER")
						.requestMatchers("/api/admin/**").hasRole(ADMIN)
						// Hexschool 這支是公開的，但回應含全部訂單個資，且現有前端沒有使用，因此要求 admin
						.requestMatchers(HttpMethod.GET, "/api/orders").hasRole(ADMIN)
						.requestMatchers("/api/**", "/admin/signin", "/logout", "/error").permitAll()
						.requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
						.anyRequest().denyAll())
				.addFilterBefore(new JwtAuthenticationFilter(jwtService, userRepository),
						UsernamePasswordAuthenticationFilter.class);
		return http.build();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
		CorsConfiguration configuration = new CorsConfiguration();
		configuration.setAllowedOrigins(properties.cors().allowedOrigins());
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", CartOwner.HEADER));
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}
}
