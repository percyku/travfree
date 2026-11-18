package com.percyku.backend.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.OAuthCodeRequest;
import com.percyku.backend.security.oauth.OAuthClient;
import com.percyku.backend.security.oauth.OAuthProviders;
import com.percyku.backend.service.IdentityService;
import com.percyku.backend.service.OAuthAuthService;

import jakarta.validation.Valid;

/** GitHub、Facebook 登入（授權碼流程）。Google 用 ID token，在 AuthController。 */
@RestController
public class OAuthController {

	private final OAuthProviders providers;
	private final OAuthAuthService oauthAuthService;

	public OAuthController(OAuthProviders providers, OAuthAuthService oauthAuthService) {
		this.providers = providers;
		this.oauthAuthService = oauthAuthService;
	}

	/** 前端以它決定顯示哪些按鈕並組出授權網址；client ID 與網址只在後端設定。 */
	@GetMapping("/api/user/oauth/config")
	public Map<String, Object> config() {
		Map<String, Object> result = new LinkedHashMap<>();
		for (String provider : OAuthProviders.names()) {
			var client = providers.find(provider);
			Map<String, Object> config = new LinkedHashMap<>();
			config.put("enabled", client.isPresent());
			config.put("client_id", client.map(OAuthClient::clientId).orElse(""));
			config.put("authorize_url", client.map(OAuthClient::authorizeUrl).orElse(""));
			config.put("scope", client.map(OAuthClient::scope).orElse(""));
			result.put(provider, config);
		}
		return ApiResponses.of("providers", result);
	}

	@PostMapping("/api/user/oauth/{provider}")
	public Map<String, Object> signin(@PathVariable String provider,
			@Valid @RequestBody DataRequest<OAuthCodeRequest> request) {
		IdentityService.Result result = oauthAuthService.signin(provider, request.data());
		return AuthController.tokenResponse(result.created() ? "註冊成功" : "登入成功", result.signin());
	}

	@PostMapping("/api/user/oauth/{provider}/link")
	public Map<String, Object> link(Authentication authentication, @PathVariable String provider,
			@Valid @RequestBody DataRequest<OAuthCodeRequest> request) {
		var profile = oauthAuthService.link(authentication.getName(), provider, request.data());
		return ApiResponses.message("已連結 " + OAuthProviders.displayName(provider), "profile", profile);
	}

	@DeleteMapping("/api/user/oauth/{provider}/link")
	public Map<String, Object> unlink(Authentication authentication, @PathVariable String provider) {
		var profile = oauthAuthService.unlink(authentication.getName(), provider);
		return ApiResponses.message("已解除連結 " + OAuthProviders.displayName(provider), "profile", profile);
	}
}
