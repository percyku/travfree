import { useEffect, useRef, useState } from "react";
import { loadGoogleConfig, loadGsi } from "../utils/google";

/**
 * Google 的「Sign in with Google」按鈕（GIS renderButton），按下後以 ID token（credential）呼叫 onCredential。
 * 後端沒有設定 Google 登入時不顯示。
 *
 * GIS 的 callback 是全域的（以最後一次 initialize 為準），所以同一個畫面只放一個 Google 按鈕。
 *
 * @param {object} props
 * @param {(credential: string) => void} props.onCredential
 * @param {"signin_with"|"signup_with"|"continue_with"} [props.text] 按鈕文字
 * @param {React.ReactNode} [props.before] 啟用時顯示在按鈕前（例如「或」的分隔線）
 */
const GoogleButton = ({ onCredential, text = "continue_with", before = null }) => {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [enabled, setEnabled] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let active = true;
    (async () => {
      const config = await loadGoogleConfig();
      if (!active || !config.enabled) return;
      setEnabled(true);
      try {
        const google = await loadGsi();
        if (!active || !containerRef.current) return;
        google.accounts.id.initialize({
          client_id: config.clientId,
          callback: (response) => callbackRef.current(response.credential),
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          locale: "zh-TW",
          width: containerRef.current.offsetWidth || 320,
        });
      } catch (error) {
        if (active) setLoadError(error.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [text]);

  // 容器一直存在：GIS 要在設定讀回來之後立刻畫進去，不能等下一次 render。關閉時是空的，不佔空間
  return (
    <>
      {enabled && before}
      <div ref={containerRef} className="d-flex justify-content-center" />
      {loadError && <p className="text-alert mt-2 mb-0">{loadError}</p>}
    </>
  );
};

export default GoogleButton;
