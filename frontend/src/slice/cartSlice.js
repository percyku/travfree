import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { createAsyncMessage } from "./messageSlice";
import axios from "axios";
const { VITE_APP_API_BASE, VITE_APP_API_PATH } = import.meta.env;
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
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/cart`,
      );
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
      const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/cart`;
      const res = await axios.post(url, { data });

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
      const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/cart/${cartId}`;
      const res = await axios.put(url, { data });
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
      const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/cart/${id}`;
      await axios.delete(url);
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
      const url = `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/carts`;
      await axios.delete(url);

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

export const { updateCart, updateLoading } = cartSlice.actions;
export default cartSlice.reducer;
