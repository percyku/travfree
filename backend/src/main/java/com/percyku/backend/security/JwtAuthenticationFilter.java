package com.percyku.backend.security;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.percyku.backend.entity.User;
import com.percyku.backend.repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 前端的 Authorization 是裸 token（沒有 Bearer），兩種格式都接受。
 * token 無效時不在這裡拒絕，而是以匿名身分往下走：前端登入後 axios 會在所有請求帶上 token，
 * 若在此回 401，過期 token 也會打壞公開的 Front API。是否需要登入由 SecurityConfig 決定。
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtService jwtService;
	private final UserRepository userRepository;

	public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
		this.jwtService = jwtService;
		this.userRepository = userRepository;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		String header = request.getHeader(HttpHeaders.AUTHORIZATION);
		if (header != null && !header.isBlank()) {
			String token = header.startsWith(BEARER_PREFIX) ? header.substring(BEARER_PREFIX.length()) : header;
			findUser(token).ifPresent(JwtAuthenticationFilter::authenticate);
		}
		chain.doFilter(request, response);
	}

	private Optional<User> findUser(String token) {
		return jwtService.parse(token).flatMap(claims -> userRepository.findById(claims.uid())
				.filter(user -> user.getTokenVersion() == claims.version()));
	}

	private static void authenticate(User user) {
		var authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
		SecurityContextHolder.getContext().setAuthentication(
				new UsernamePasswordAuthenticationToken(user.getId(), null, List.of(authority)));
	}
}
