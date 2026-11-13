package com.percyku.backend;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

/**
 * 以測試用的 RSA 金鑰簽出 Google 格式的 ID token。後端在測試中以 app.google.test-public-key 設定對應的公鑰
 * （見 ApiTestSupport），所以不連 Google。金鑰在每次執行時產生，不放進 repo。
 */
final class GoogleTestTokens {

	static final String CLIENT_ID = "test-client.apps.googleusercontent.com";
	static final String ISSUER = "https://accounts.google.com";

	private static final KeyPair KEYS = generate();
	/** 驗證不通過用：同樣格式、不同金鑰 */
	private static final KeyPair OTHER_KEYS = generate();

	private GoogleTestTokens() {
	}

	static String publicKeyBase64() {
		return Base64.getEncoder().encodeToString(KEYS.getPublic().getEncoded());
	}

	/** 已驗證 email 的一般 Google 帳號 */
	static String token(String sub, String email, String name) {
		return builder(sub, email, name).sign();
	}

	static Builder builder(String sub, String email, String name) {
		return new Builder(sub, email, name);
	}

	static final class Builder {
		private final JWTClaimsSet.Builder claims;
		private KeyPair keys = KEYS;

		private Builder(String sub, String email, String name) {
			Instant now = Instant.now();
			claims = new JWTClaimsSet.Builder()
					.issuer(ISSUER)
					.audience(List.of(CLIENT_ID))
					.subject(sub)
					.issueTime(Date.from(now))
					.expirationTime(Date.from(now.plusSeconds(3600)))
					.claim("email", email)
					.claim("email_verified", true)
					.claim("name", name);
		}

		Builder claim(String name, Object value) {
			claims.claim(name, value);
			return this;
		}

		Builder issuer(String issuer) {
			claims.issuer(issuer);
			return this;
		}

		Builder audience(String audience) {
			claims.audience(audience);
			return this;
		}

		Builder expiredAt(Instant expiredAt) {
			claims.expirationTime(Date.from(expiredAt));
			return this;
		}

		Builder signedWithOtherKey() {
			keys = OTHER_KEYS;
			return this;
		}

		String sign() {
			SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(),
					claims.build());
			try {
				jwt.sign(new RSASSASigner((RSAPrivateKey) keys.getPrivate()));
			} catch (JOSEException e) {
				throw new IllegalStateException(e);
			}
			return jwt.serialize();
		}
	}

	private static KeyPair generate() {
		try {
			KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
			generator.initialize(2048);
			return generator.generateKeyPair();
		} catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}
}
