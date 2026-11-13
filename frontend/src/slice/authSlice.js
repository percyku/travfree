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

/**
 * Google 登入或註冊（credential 是 GIS 的 ID token）。回傳 { user, created }：created 表示新建立的帳號。
 * email 已有帳號時後端回 409，reject 後端的說明（請先用原本的方式登入再連結），不會自動合併
 */
export const googleSignin = createAsyncThunk(
  "auth/googleSignin",
  async (credential, { dispatch, rejectWithValue }) => {
    let created;
    try {
      const res = await axios.post(`${VITE_APP_API_BASE}/api/user/google`, {
        data: { credential },
      });
      saveToken(res.data.token, res.data.expired);
      created = res.data.message === "註冊成功";
    } catch (error) {
      return rejectWithValue(messageOf(error, "Google 登入失敗，請再試一次"));
    }
    await mergeGuestCart(dispatch);
    const user = await dispatch(checkAuth()).unwrap();
    return { user, created };
  },
);

/** 把 Google 帳號連結到目前的帳號，回傳更新後的 profile */
export const linkGoogle = createAsyncThunk(
  "auth/linkGoogle",
  async (credential, { rejectWithValue }) => {
    try {
      const res = await axios.post(`${VITE_APP_API_BASE}/api/user/google/link`, {
        data: { credential },
      });
      return res.data.profile;
    } catch (error) {
      return rejectWithValue(messageOf(error, "連結 Google 失敗，請再試一次"));
    }
  },
);

export const unlinkGoogle = createAsyncThunk(
  "auth/unlinkGoogle",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.delete(`${VITE_APP_API_BASE}/api/user/google/link`);
      return res.data.profile;
    } catch (error) {
      return rejectWithValue(messageOf(error, "解除連結失敗，請再試一次"));
    }
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

/**
 * 前台登出：之後重新讀取購物車，變回這個瀏覽器的訪客購物車（登入時已併入帳號，所以是空的）。
 * @param {{ from: string }} arg 登出時所在的頁面路徑，見 signedOutFrom
 */
export const memberSignout = createAsyncThunk(
  "auth/memberSignout",
  async (_, { dispatch }) => {
    await dispatch(signout());
    dispatch(createAsyncGetCart());
  },
);

/** 會員中心與填寫資料頁使用；tel、address 未填時是空字串 */
export const fetchProfile = createAsyncThunk(
  "auth/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(`${VITE_APP_API_BASE}/api/user/profile`);
      return res.data.profile;
    } catch (error) {
      return rejectWithValue(messageOf(error, "讀取會員資料失敗，請再試一次"));
    }
  },
);

/** 更新後 Header 的姓名跟著改（見 reducer） */
export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async ({ name, tel, address }, { rejectWithValue }) => {
    try {
      const res = await axios.put(`${VITE_APP_API_BASE}/api/user/profile`, {
        data: { name, tel, address },
      });
      return res.data.profile;
    } catch (error) {
      return rejectWithValue(messageOf(error, "儲存失敗，請再試一次"));
    }
  },
);

/**
 * 變更密碼（帶 password），或沒有密碼的帳號第一次設定（帶 credential：重新以 Google 驗證）。
 * 成功後舊 token 全部失效，改存回應的新 token，目前的裝置才能維持登入
 */
export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async ({ password, credential, newPassword }, { rejectWithValue }) => {
    try {
      const data = credential
        ? { credential, new_password: newPassword }
        : { password, new_password: newPassword };
      const res = await axios.put(`${VITE_APP_API_BASE}/api/user/password`, {
        data,
      });
      saveToken(res.data.token, res.data.expired);
    } catch (error) {
      return rejectWithValue(messageOf(error, "變更密碼失敗，請再試一次"));
    }
  },
);

export const authSlice = createSlice({
  name: "auth",
  initialState: {
    /** { uid, email, name, roles } 或 null */
    user: null,
    /** 是否已經確認過登入狀態。確認前 user 是 null 不代表未登入，需要登入的頁面要等它變成 true 再導向 */
    checked: false,
    /**
     * 前台主動登出時所在的頁面路徑。需要登入的頁面（會員中心、填寫資料頁）看到是自己時回首頁，
     * 不當成「未登入」導向登入頁。記錄路徑而不是 true，其他頁面登出後再開啟這些頁面時仍會導向登入頁。
     * 不能靠「先離開頁面再登出」：React Router 的導向是低優先的 transition，裝置較慢時登出的狀態更新會先到，
     * 頁面在離開前就看到 user 變成 null。頁面卸載時以 signoutHandled 清除
     */
    signedOutFrom: null,
  },
  reducers: {
    signoutHandled(state) {
      state.signedOutFrom = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload;
        state.checked = true;
        if (action.payload) state.signedOutFrom = null;
      })
      .addCase(signout.fulfilled, (state) => {
        state.user = null;
      })
      // 在清除 user 之前記下，頁面看到 user 變成 null 時一定已經看得到這個標記
      .addCase(memberSignout.pending, (state, action) => {
        state.signedOutFrom = action.meta.arg?.from ?? null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        if (state.user) state.user.name = action.payload.name;
      });
  },
});

export const { signoutHandled } = authSlice.actions;

export default authSlice.reducer;
