package com.percyku.backend.security.oauth;

/**
 * 以授權碼（authorization code）流程登入的平台。前端把使用者導到 {@link #authorizeUrl()}，
 * 平台帶 code 導回後，由後端以 client secret 換 token 並取得平台的帳號資料。
 */
public interface OAuthClient {

	/** 網址與資料表使用的名稱，例如 github。 */
	String provider();

	boolean isEnabled();

	/** 沒有設定時為空字串。 */
	String clientId();

	/** 沒有設定時為空字串。 */
	String authorizeUrl();

	/** 授權頁的 scope，以空白分隔。 */
	String scope();

	/**
	 * 用 code 換 token 並取得帳號資料。
	 *
	 * @param codeVerifier PKCE，沒有時為 null
	 * @param invalidMessage code 無效時的訊息（登入與設定密碼不同）
	 * @throws com.percyku.backend.exception.ApiException 400 code 無效；502 平台無法連線；503 未設定
	 */
	OAuthAccount exchange(String code, String redirectUri, String codeVerifier, String invalidMessage);

	/**
	 * @param subject 平台的帳號 ID，不會變
	 * @param email 已驗證的 email，平台沒有提供時為 null
	 * @param name 顯示名稱，可能為 null
	 */
	record OAuthAccount(String subject, String email, String name) {
	}
}
