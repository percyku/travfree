import { useEffect, useState } from "react";
import GoogleButton from "./GoogleButton";
import OAuthButton from "./OAuthButton";
import { loadGoogleConfig } from "../utils/google";
import { PROVIDER_NAMES, enabledProviders, loadOAuthConfig, startOAuth } from "../utils/oauth";

/**
 * 登入頁與註冊頁的第三方登入：Google（GIS 的按鈕）與 GitHub 等（導向授權頁）。
 * 後端有啟用任何一種時才顯示「或」的分隔線。
 *
 * @param {object} props
 * @param {"signin"|"signup"} props.mode 按鈕文字
 * @param {(credential: string) => void} props.onGoogleCredential
 * @param {string} props.returnTo 以 GitHub 等登入後回到的頁面
 * @param {boolean} [props.disabled]
 */
const SocialSignin = ({ mode, onGoogleCredential, returnTo, disabled = false }) => {
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    let active = true;
    loadGoogleConfig().then((config) => active && setGoogleEnabled(config.enabled));
    loadOAuthConfig().then((config) => active && setProviders(enabledProviders(config)));
    return () => {
      active = false;
    };
  }, []);

  const verb = mode === "signup" ? "註冊" : "登入";
  return (
    <>
      {(googleEnabled || providers.length > 0) && (
        <div className="d-flex align-items-center gap-3 my-4 text-muted">
          <hr className="flex-grow-1 my-0" />
          或
          <hr className="flex-grow-1 my-0" />
        </div>
      )}
      <GoogleButton
        text={mode === "signup" ? "signup_with" : "signin_with"}
        onCredential={onGoogleCredential}
      />
      {providers.map((config, index) => (
        <div key={config.provider} className={googleEnabled || index > 0 ? "mt-3" : ""}>
          <OAuthButton
            provider={config.provider}
            label={`使用 ${PROVIDER_NAMES[config.provider] ?? config.provider} ${verb}`}
            disabled={disabled}
            onClick={() => startOAuth(config, { purpose: "signin", returnTo })}
          />
        </div>
      ))}
    </>
  );
};

export default SocialSignin;
