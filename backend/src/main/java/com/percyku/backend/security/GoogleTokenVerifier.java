package com.percyku.backend.security;

import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;

/**
 * 依 Google 文件驗證 Sign In With Google 的 ID token：簽章（Google 的 JWKS，依 Cache-Control 快取）、
 * aud 是我們的 client ID、iss 是 accounts.google.com、未過期。
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */
@Component
public class GoogleTokenVerifier {

	static final String GOOGLE_JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
	static final Set<String> GOOGLE_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");
	public static final String INVALID = "Google 驗證失敗，請再試一次";

	private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifier.class);

	private final String clientId;
	private final NimbusJwtDecoder decoder;

	public GoogleTokenVerifier(AppProperties properties) {
		AppProperties.Google google = properties.google();
		this.clientId = google == null || google.clientId() == null ? "" : google.clientId().strip();
		if (clientId.isEmpty()) {
			this.decoder = null;
			return;
		}
		String testKey = google.testPublicKey();
		NimbusJwtDecoder built;
		if (testKey == null || testKey.isBlank()) {
			built = NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWK_SET_URI).build();
		} else {
			log.warn("GOOGLE_TEST_PUBLIC_KEY 已設定：以測試公鑰驗證 Google ID token，不連 Google。只能用於 E2E");
			built = NimbusJwtDecoder.withPublicKey(parsePublicKey(testKey)).build();
		}
		built.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				new JwtTimestampValidator(),
				// iss 可能被轉成 URL，以字串比對兩種寫法
				new JwtClaimValidator<Object>("iss", iss -> iss != null && GOOGLE_ISSUERS.contains(iss.toString())),
				new JwtClaimValidator<Object>("aud", aud -> aud instanceof java.util.Collection<?> list
						? list.contains(clientId)
						: clientId.equals(String.valueOf(aud)))));
		this.decoder = built;
	}

	public boolean isEnabled() {
		return decoder != null;
	}

	public String clientId() {
		return clientId;
	}

	/** @throws ApiException 503 未設定；400 token 無效 */
	public GoogleAccount verify(String credential) {
		return verify(credential, INVALID);
	}

	public GoogleAccount verify(String credential, String invalidMessage) {
		if (!isEnabled()) {
			throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "未設定 Google 登入");
		}
		Jwt jwt;
		try {
			jwt = decoder.decode(credential);
		} catch (JwtException e) {
			log.debug("Google ID token 驗證失敗: {}", e.getMessage());
			throw ApiException.badRequest(invalidMessage);
		}
		if (jwt.getSubject() == null || jwt.getSubject().isBlank()) {
			throw ApiException.badRequest(invalidMessage);
		}
		// Google 的 email_verified 是布林值，舊版本曾是字串
		Object verified = jwt.getClaim("email_verified");
		return new GoogleAccount(jwt.getSubject(), jwt.getClaimAsString("email"),
				Boolean.TRUE.equals(verified) || "true".equals(verified), jwt.getClaimAsString("name"));
	}

	/** 接受 PEM（含 BEGIN/END）或只有 base64 的 X.509 公鑰，方便放在環境變數裡。 */
	static RSAPublicKey parsePublicKey(String value) {
		String base64 = value.replaceAll("-----(BEGIN|END) PUBLIC KEY-----", "").replaceAll("\\s", "");
		try {
			return (RSAPublicKey) KeyFactory.getInstance("RSA")
					.generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(base64)));
		} catch (Exception e) {
			throw new IllegalStateException("GOOGLE_TEST_PUBLIC_KEY 不是有效的 RSA 公鑰", e);
		}
	}

	/** @param email Google 帳號目前的 email，只在建立新帳號時使用 */
	public record GoogleAccount(String subject, String email, boolean emailVerified, String name) {
	}
}
