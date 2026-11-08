package com.percyku.backend.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.entity.User;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.JwtService;
import com.percyku.backend.security.LoginAttemptLimiter;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final LoginAttemptLimiter loginAttemptLimiter;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
			LoginAttemptLimiter loginAttemptLimiter) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.loginAttemptLimiter = loginAttemptLimiter;
	}

	/** @param clientIp 用於登入次數限制，取自 request.getRemoteAddr() */
	public SigninResult signin(SigninRequest request, String clientIp) {
		loginAttemptLimiter.checkAllowed(clientIp, request.username());
		User user = userRepository.findByEmail(request.username())
				.filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
				.orElse(null);
		if (user == null) {
			loginAttemptLimiter.recordFailure(clientIp, request.username());
			throw ApiException.badRequest("登入失敗");
		}
		loginAttemptLimiter.recordSuccess(clientIp, request.username());
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	@Transactional
	public void logout(String uid) {
		userRepository.findById(uid).ifPresent(User::revokeTokens);
	}

	public record SigninResult(String uid, JwtService.IssuedToken token) {
	}
}
