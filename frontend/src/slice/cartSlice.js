import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { createAsyncMessage } from "./messageSlice";
import axios from "axios";
import { cartConfig } from "../utils/cart";
const { VITE_APP_API_BASE } = import.meta.env;

// 購物車依呼叫者區分：登入時是帳號的購物車，否則是 X-Cart-Id 的訪客購物車（見 spec 的 GET /api/cart）
export const cartSlice = createSlice({
  name: "cart",
  initialState: {
    carts: [],
    total: 0,
    final_total: 0,
    isLoading: false,
  },
  //actions
  reducers: {
    updateCart(state, action) {
      state.carts = action.payload.carts || [];
      state.total = action.payload.total || 0;
      state.final_total = action.payload.final_total || 0;
      state.isLoading = false;
    },
    updateLoading(state, action) {
      state.isLoading = action.payload || false;
    },
  },
});

export const createAsyncGetCart = createAsyncThunk(
  "cart/createAsyncGetCart",
  async (_, { dispatch }) => {
    try {
      const res = await axios.get(`${VITE_APP_API_BASE}/api/cart`, cartConfig());
      dispatch(updateCart(res.data.data));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得購物車失敗",
          success: false,
        }),
      );
      throw error;
    }
  },
);

export const createAsyncAddCart = createAsyncThunk(
  "cart/createAsyncAddCart",
  async ({ id, qty }, { dispatch }) => {
    const data = {
      product_id: id,
      qty: qty,
    };
    try {
      dispatch(updateLoading(true));
      const url = `${VITE_APP_API_BASE}/api/cart`;
      const res = await axios.post(url, { data }, cartConfig());

      dispatch(
        createAsyncMessage({
          message: `加入${res.data.data.product.title}成功`,
          success: true,
        }),
      );

      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "加入購物車失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncUpdateCart = createAsyncThunk(
  "cart/createAsyncUpdateCart",
  async ({ cartId, productId, qty }, { dispatch }) => {
    const data = {
      product_id: productId,
      qty: qty,
    };
    try {
      dispatch(updateLoading(true));
      const url = `${VITE_APP_API_BASE}/api/cart/${cartId}`;
      await axios.put(url, { data }, cartConfig());
      dispatch(
        createAsyncMessage({
          message: `更新成功`,
          success: true,
        }),
      );

      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "加入購物車失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncDeleteCart = createAsyncThunk(
  "cart/createAsyncDeleteCart",
  async (id, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const url = `${VITE_APP_API_BASE}/api/cart/${id}`;
      await axios.delete(url, cartConfig());
      dispatch(
        createAsyncMessage({
          message: `刪除成功`,
          success: true,
        }),
      );

      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || `刪除失敗`,
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncDeleteAllCart = createAsyncThunk(
  "cart/createAsyncDeleteAllCart",
  async (_, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const url = `${VITE_APP_API_BASE}/api/carts`;
      await axios.delete(url, cartConfig());

      dispatch(
        createAsyncMessage({
          message: `刪除全部項目成功`,
          success: true,
        }),
      );

      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || `刪除全部項目失敗`,
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

// 優惠券只套用在目前購物車內的品項，之後才加入的品項不帶優惠（見 spec 的 POST /api/coupon）
export const createAsyncApplyCoupon = createAsyncThunk(
  "cart/createAsyncApplyCoupon",
  async (code, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const res = await axios.post(
        `${VITE_APP_API_BASE}/api/coupon`,
        { data: { code } },
        cartConfig(),
      );
      dispatch(
        createAsyncMessage({
          message: res.data.message,
          success: true,
        }),
      );
      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "套用優惠券失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncRemoveCoupon = createAsyncThunk(
  "cart/createAsyncRemoveCoupon",
  async (_, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const res = await axios.delete(
        `${VITE_APP_API_BASE}/api/coupon`,
        cartConfig(),
      );
      dispatch(
        createAsyncMessage({
          message: res.data.message,
          success: true,
        }),
      );
      dispatch(createAsyncGetCart());
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "移除優惠券失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const { updateCart, updateLoading } = cartSlice.actions;
export default cartSlice.reducer;
