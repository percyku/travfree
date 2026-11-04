package com.percyku.backend.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.SigninRequest;
import com.percyku.backend.entity.User;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.UserRepository;
import com.percyku.backend.security.JwtService;

@Service
public class AuthService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;

	public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	public SigninResult signin(SigninRequest request) {
		User user = userRepository.findByEmail(request.username())
				.filter(found -> passwordEncoder.matches(request.password(), found.getPasswordHash()))
				.orElseThrow(() -> ApiException.badRequest("登入失敗"));
		return new SigninResult(user.getId(), jwtService.issue(user));
	}

	@Transactional
	public void logout(String uid) {
		userRepository.findById(uid).ifPresent(User::revokeTokens);
	}

	public record SigninResult(String uid, JwtService.IssuedToken token) {
	}
}
