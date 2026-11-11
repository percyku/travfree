package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.dto.SignupRequest;
import com.percyku.backend.entity.User;
import com.percyku.backend.service.AuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	/** 後台登入頁使用，只接受有 ADMIN 角色的帳號。 */
	@PostMapping("/admin/signin")
	public Map<String, Object> adminSignin(@Valid @RequestBody SigninRequest request, HttpServletRequest httpRequest) {
		// 預設不信任 X-Forwarded-For；放在反向代理後面時，以 server.forward-headers-strategy 設定
		return tokenResponse("登入成功", authService.signin(request, httpRequest.getRemoteAddr(), true));
	}

	/** 前台登入頁使用，任何角色都可以登入。 */
	@PostMapping("/api/user/signin")
	public Map<String, Object> signin(@Valid @RequestBody SigninRequest request, HttpServletRequest httpRequest) {
		return tokenResponse("登入成功", authService.signin(request, httpRequest.getRemoteAddr(), false));
	}

	@PostMapping("/api/user/signup")
	public Map<String, Object> signup(@Valid @RequestBody DataRequest<SignupRequest> request) {
		return tokenResponse("註冊成功", authService.signup(request.data()));
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
		User user = authService.currentUser(authentication.getName());
		Map<String, Object> body = ApiResponses.of("uid", user.getId());
		body.put("email", user.getEmail());
		body.put("name", user.getName());
		body.put("roles", user.getRoles());
		return body;
	}

	private static Map<String, Object> tokenResponse(String message, AuthService.SigninResult result) {
		Map<String, Object> body = ApiResponses.message(message, "uid", result.uid());
		body.put("token", result.token().token());
		body.put("expired", result.token().expiredAtMillis());
		return body;
	}
}
