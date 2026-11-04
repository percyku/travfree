package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.service.AuthService;

import jakarta.validation.Valid;

@RestController
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/admin/signin")
	public Map<String, Object> signin(@Valid @RequestBody SigninRequest request) {
		AuthService.SigninResult result = authService.signin(request);
		Map<String, Object> body = ApiResponses.message("登入成功", "uid", result.uid());
		body.put("token", result.token().token());
		body.put("expired", result.token().expiredAtMillis());
		return body;
	}

	@PostMapping("/logout")
	public Map<String, Object> logout(Authentication authentication) {
		if (authentication != null) {
			authService.logout(authentication.getName());
		}
		return ApiResponses.message("已登出");
	}

	@PostMapping("/api/user/check")
	public Map<String, Object> check(Authentication authentication) {
		return ApiResponses.of("uid", authentication.getName());
	}
}
