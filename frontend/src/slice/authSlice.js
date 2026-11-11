import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { clearToken, getToken, saveToken } from "../utils/auth";
import { cartConfig } from "../utils/cart";
import { createAsyncGetCart } from "./cartSlice";

const { VITE_APP_API_BASE } = import.meta.env;

const toUser = ({ uid, email, name, roles }) => ({ uid, email, name, roles });

const messageOf = (error, fallback) =>
  error.response?.data?.message || fallback;

/**
 * 以 cookie 中的 token 向後端確認登入狀態，回傳帳號或 null。
 * token 失效（401）時清除 cookie；其他錯誤（例如網路斷線）保留 token，下次再確認。
 */
export const checkAuth = createAsyncThunk("auth/check", async () => {
  const token = getToken();
  if (token === undefined) return null;
  axios.defaults.headers.common.Authorization = token;
  try {
    const res = await axios.post(`${VITE_APP_API_BASE}/api/user/check`);
    return toUser(res.data);
  } catch (error) {
    if (error.response?.status === 401) clearToken();
    return null;
  }
});

/**
 * 把訪客購物車併入剛登入的帳號，再重新讀取購物車（Header 的數量）。
 * 合併失敗不影響登入，訪客購物車留在原處，登出後仍看得到。
 */
const mergeGuestCart = async (dispatch) => {
  try {
    await axios.post(`${VITE_APP_API_BASE}/api/cart/merge`, null, cartConfig());
  } catch {
    // 忽略
  }
  dispatch(createAsyncGetCart());
};

/** 前台登入。失敗時 reject 後端的原因（例如 429 的等待時間） */
export const signin = createAsyncThunk(
  "auth/signin",
  async (form, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.post(
        `${VITE_APP_API_BASE}/api/user/signin`,
        form,
      );
      saveToken(res.data.token, res.data.expired);
    } catch (error) {
      return rejectWithValue(messageOf(error, "登入失敗，請再試一次"));
    }
    await mergeGuestCart(dispatch);
    return dispatch(checkAuth()).unwrap();
  },
);

/** 註冊成功時後端直接回傳 token，所以註冊完就是登入狀態 */
export const signup = createAsyncThunk(
  "auth/signup",
  async ({ email, password, name }, { dispatch, rejectWithValue }) => {
    try {
      const res = await axios.post(`${VITE_APP_API_BASE}/api/user/signup`, {
        data: { email, password, name },
      });
      saveToken(res.data.token, res.data.expired);
    } catch (error) {
      return rejectWithValue(messageOf(error, "註冊失敗，請再試一次"));
    }
    await mergeGuestCart(dispatch);
    return dispatch(checkAuth()).unwrap();
  },
);

/** 讓伺服器撤銷 token（否則到期前仍然有效）；網路錯誤時仍清掉本機的 token */
export const signout = createAsyncThunk("auth/signout", async () => {
  try {
    await axios.post(`${VITE_APP_API_BASE}/logout`);
  } catch {
    // 忽略，下面一樣清除
  } finally {
    clearToken();
  }
});

export const authSlice = createSlice({
  name: "auth",
  initialState: {
    /** { uid, email, name, roles } 或 null */
    user: null,
    /** 是否已經確認過登入狀態。確認前 user 是 null 不代表未登入，需要登入的頁面要等它變成 true 再導向 */
    checked: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.checked = true;
      })
      .addCase(signout.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export default authSlice.reducer;
