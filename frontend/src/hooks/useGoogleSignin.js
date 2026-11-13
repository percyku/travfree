import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { googleSignin } from "../slice/authSlice";
import { createAsyncMessage } from "../slice/messageSlice";

/**
 * 登入頁與註冊頁的 Google 按鈕共用：成功時顯示歡迎訊息（頁面看到 user 後自行離開），
 * 失敗時以 onError 交給頁面顯示（例如 409：email 已有帳號，請先用原本的方式登入再連結）。
 */
const useGoogleSignin = ({ onError, setSubmitting }) => {
  const dispatch = useDispatch();
  return useCallback(
    async (credential) => {
      onError("");
      setSubmitting(true);
      try {
        const { user, created } = await dispatch(googleSignin(credential)).unwrap();
        const name = user?.name ?? "";
        dispatch(
          createAsyncMessage({
            success: true,
            message: created ? `註冊成功，歡迎 ${name}` : `歡迎回來，${name}`,
          }),
        );
      } catch (message) {
        onError(typeof message === "string" ? message : "Google 登入失敗，請再試一次");
      } finally {
        setSubmitting(false);
      }
    },
    [dispatch, onError, setSubmitting],
  );
};

export default useGoogleSignin;
