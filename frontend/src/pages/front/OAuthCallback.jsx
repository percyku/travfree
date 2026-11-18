import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { linkOAuth, oauthSignin } from "../../slice/authSlice";
import { createAsyncMessage } from "../../slice/messageSlice";
import { PROVIDER_NAMES, codeInput, takeOAuthResult } from "../../utils/oauth";

/**
 * GitHub 等平台授權後回到這裡（main.jsx 已把 code 從網址移除，見 utils/oauth.js），依當初的用途：
 * - signin：登入或註冊，成功回到原本的頁面；失敗回登入頁並顯示原因（例如 409 email 已有帳號）
 * - link：連結到目前的帳號，回會員中心
 * - password：把 code 帶回會員中心，由使用者填好新密碼後送出
 */
const OAuthCallback = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const authChecked = useSelector((state) => state.auth.checked);
  // 只能取一次：重新整理本頁時已經沒有 code
  const [result] = useState(takeOAuthResult);
  const started = useRef(false);

  useEffect(() => {
    // 連結與設定密碼要帶 token，等 Header 確認過登入狀態（設定好 Authorization）
    if (!authChecked || started.current) return;
    started.current = true;
    const { pending, error } = result;
    const purpose = pending?.purpose ?? "signin";
    const returnTo = pending?.returnTo ?? "/";

    const fail = (message) => {
      if (purpose === "signin") {
        navigate("/signin", { replace: true, state: { oauthError: message, from: returnTo } });
      } else {
        dispatch(createAsyncMessage({ success: false, message }));
        navigate("/member", { replace: true });
      }
    };
    if (error) {
      fail(error);
      return;
    }

    const { provider } = pending;
    const data = codeInput(result);
    if (purpose === "password") {
      navigate("/member", { replace: true, state: { reauth: { provider, ...data } } });
      return;
    }
    (async () => {
      try {
        if (purpose === "link") {
          await dispatch(linkOAuth({ provider, data })).unwrap();
          dispatch(
            createAsyncMessage({ success: true, message: `已連結 ${PROVIDER_NAMES[provider]}` }),
          );
          navigate("/member", { replace: true });
          return;
        }
        const { user, created } = await dispatch(oauthSignin({ provider, data })).unwrap();
        const name = user?.name ?? "";
        dispatch(
          createAsyncMessage({
            success: true,
            message: created ? `註冊成功，歡迎 ${name}` : `歡迎回來，${name}`,
          }),
        );
        navigate(returnTo, { replace: true });
      } catch (message) {
        fail(typeof message === "string" ? message : "登入失敗，請再試一次");
      }
    })();
  }, [authChecked, result, dispatch, navigate]);

  return (
    <div className="margin-top cart-bg">
      <div className="container py-10 text-center">
        <div className="spinner-border text-primary mb-3" aria-hidden="true" />
        <p className="mb-0" role="status">
          正在處理登入⋯
        </p>
      </div>
    </div>
  );
};

export default OAuthCallback;
