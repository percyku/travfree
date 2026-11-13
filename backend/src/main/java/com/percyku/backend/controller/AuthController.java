package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.GoogleCredentialRequest;
import com.percyku.backend.dto.PasswordChangeRequest;
import com.percyku.backend.dto.ProfileRequest;
import com.percyku.backend.dto.ProfileResponse;
import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.dto.SignupRequest;
import com.percyku.backend.entity.User;
import com.percyku.backend.security.GoogleTokenVerifier;
import com.percyku.backend.service.AuthService;
import com.percyku.backend.service.GoogleAuthService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
public class AuthController {

	private final AuthService authService;
	private final GoogleAuthService googleAuthService;
	private final GoogleTokenVerifier googleTokenVerifier;

	public AuthController(AuthService authService, GoogleAuthService googleAuthService,
			GoogleTokenVerifier googleTokenVerifier) {
		this.authService = authService;
		this.googleAuthService = googleAuthService;
		this.googleTokenVerifier = googleTokenVerifier;
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

	/** 會員中心與結帳的填寫資料頁使用；身分由 token 決定，網址不帶 id。 */
	@GetMapping("/api/user/profile")
	public Map<String, Object> profile(Authentication authentication) {
		return ApiResponses.of("profile", authService.profile(authentication.getName()));
	}

	@PutMapping("/api/user/profile")
	public Map<String, Object> updateProfile(Authentication authentication,
			@Valid @RequestBody DataRequest<ProfileRequest> request) {
		ProfileResponse profile = authService.updateProfile(authentication.getName(), request.data());
		return ApiResponses.message("已更新會員資料", "profile", profile);
	}

	@PutMapping("/api/user/password")
	public Map<String, Object> changePassword(Authentication authentication,
			@Valid @RequestBody DataRequest<PasswordChangeRequest> request, HttpServletRequest httpRequest) {
		// 沒有密碼的帳號是第一次設定，要在變更之前判斷
		boolean firstPassword = !authService.currentUser(authentication.getName()).hasPassword();
		AuthService.SigninResult result = authService.changePassword(authentication.getName(), request.data(),
				httpRequest.getRemoteAddr());
		return tokenResponse(firstPassword ? "已設定密碼" : "已變更密碼", result);
	}

	/** 前端以它決定是否顯示 Google 按鈕；client ID 只在後端設定一處。 */
	@GetMapping("/api/user/google/config")
	public Map<String, Object> googleConfig() {
		Map<String, Object> body = ApiResponses.of("enabled", googleTokenVerifier.isEnabled());
		body.put("client_id", googleTokenVerifier.clientId());
		return body;
	}

	@PostMapping("/api/user/google")
	public Map<String, Object> googleSignin(@Valid @RequestBody DataRequest<GoogleCredentialRequest> request) {
		GoogleAuthService.Result result = googleAuthService.signin(request.data().credential());
		return tokenResponse(result.created() ? "註冊成功" : "登入成功", result.signin());
	}

	@PostMapping("/api/user/google/link")
	public Map<String, Object> linkGoogle(Authentication authentication,
			@Valid @RequestBody DataRequest<GoogleCredentialRequest> request) {
		return ApiResponses.message("已連結 Google", "profile",
				googleAuthService.link(authentication.getName(), request.data().credential()));
	}

	@DeleteMapping("/api/user/google/link")
	public Map<String, Object> unlinkGoogle(Authentication authentication) {
		return ApiResponses.message("已解除連結 Google", "profile", googleAuthService.unlink(authentication.getName()));
	}

	private static Map<String, Object> tokenResponse(String message, AuthService.SigninResult result) {
		Map<String, Object> body = ApiResponses.message(message, "uid", result.uid());
		body.put("token", result.token().token());
		body.put("expired", result.token().expiredAtMillis());
		return body;
	}
}
