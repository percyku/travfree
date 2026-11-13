// 登入 token 存在 cookie，並設成 axios 的預設 Authorization header。
// 前台會員與後台管理者共用同一個 token，能不能進後台看 /api/user/check 回傳的 roles。
import axios from "axios";

const { VITE_APP_TOKEN_NAME, VITE_APP_API_COOKIE_PATH } = import.meta.env;

export const getToken = () =>
  document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${VITE_APP_TOKEN_NAME}=`))
    ?.split("=")[1];

/** @param {number} expired 到期時間，Unix 毫秒（登入回應的 expired） */
export const saveToken = (token, expired) => {
  document.cookie = `${VITE_APP_TOKEN_NAME}=${token};expires=${new Date(
    expired,
  ).toUTCString()};path=${VITE_APP_API_COOKIE_PATH}`;
  axios.defaults.headers.common.Authorization = token;
};

export const clearToken = () => {
  document.cookie = `${VITE_APP_TOKEN_NAME}=; max-age=0; path=${VITE_APP_API_COOKIE_PATH}`;
  delete axios.defaults.headers.common.Authorization;
};

export const isAdmin = (user) => user?.roles?.includes("ADMIN") ?? false;

// 與 docs/openapi.yaml 的 SignupInput 規則相同
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,64}$/;
export const PASSWORD_RULE =
  "密碼需為 8–64 個英數或半形符號，且至少包含一個英文字母與一個數字";
export const NAME_MAX_LENGTH = 30;

// 與 docs/openapi.yaml 的 ProfileInput 規則相同；電話與地址選填
export const TEL_PATTERN = /^\d{8,20}$/;
export const TEL_RULE = "電話需為 8–20 個數字";
export const ADDRESS_MAX_LENGTH = 100;
