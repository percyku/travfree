package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.AdminUserResponse;
import com.percyku.backend.dto.AdminUserUpdateRequest;
import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.service.MemberAdminService;

import jakarta.validation.Valid;

/** Hexschool 沒有這組。權限（ADMIN）由 SecurityConfig 的 /api/admin/** 規則檢查。 */
@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

	private final MemberAdminService memberAdminService;

	public AdminUserController(MemberAdminService memberAdminService) {
		this.memberAdminService = memberAdminService;
	}

	@GetMapping("/users")
	public Map<String, Object> page(@RequestParam(required = false) String page,
			@RequestParam(required = false) String q) {
		return ApiResponses.page("users", memberAdminService.page(page, q));
	}

	@PutMapping("/user/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<AdminUserUpdateRequest> request, Authentication authentication) {
		return ApiResponses.message("已更新會員權限", "user", AdminUserResponse.from(
				memberAdminService.setAdmin(authentication.getName(), id, request.data().isAdmin())));
	}
}
