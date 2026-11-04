package com.percyku.backend.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.stereotype.Service;

import com.percyku.backend.config.AppProperties;
import com.percyku.backend.entity.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

	private static final String VERSION_CLAIM = "ver";

	private final SecretKey key;
	private final AppProperties.Jwt properties;

	public JwtService(AppProperties properties) {
		this.properties = properties.jwt();
		this.key = Keys.hmacShaKeyFor(this.properties.secret().getBytes(StandardCharsets.UTF_8));
	}

	public IssuedToken issue(User user) {
		Instant now = Instant.now();
		Instant expiresAt = now.plus(properties.ttl());
		String token = Jwts.builder()
				.subject(user.getId())
				.claim(VERSION_CLAIM, user.getTokenVersion())
				.issuedAt(Date.from(now))
				.expiration(Date.from(expiresAt))
				.signWith(key, Jwts.SIG.HS256)
				.compact();
		return new IssuedToken(token, expiresAt.toEpochMilli());
	}

	/** token 無效或過期時回傳空值，由呼叫端以匿名身分繼續處理。 */
	public Optional<TokenClaims> parse(String token) {
		try {
			Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
			return Optional.of(new TokenClaims(claims.getSubject(), claims.get(VERSION_CLAIM, Integer.class)));
		} catch (JwtException | IllegalArgumentException e) {
			return Optional.empty();
		}
	}

	public record IssuedToken(String token, long expiredAtMillis) {
	}

	public record TokenClaims(String uid, int version) {
	}
}
