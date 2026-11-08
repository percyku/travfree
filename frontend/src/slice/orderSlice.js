import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
const { VITE_APP_API_BASE } = import.meta.env;
import { createAsyncMessage } from "./messageSlice";
import { createAsyncGetCart } from "./cartSlice";

export const orderSlice = createSlice({
  name: "order",
  initialState: {
    orders: {},
    orderId: "",
    isLoading: false,
  },
  //actions
  reducers: {
    updateOrder(state, action) {
      state.orders = action.payload.order || {};
    },
    updateOrderId(state, action) {
      state.orderId = action.payload || "";
    },
    updateLoading(state, action) {
      state.isLoading = action.payload || false;
    },
  },
});

export const createAsyncGetOrder = createAsyncThunk(
  "order/createAsyncGetOrder",
  async (orderId, { dispatch }) => {
    try {
      const res = await axios.get(`${VITE_APP_API_BASE}/api/order/${orderId}`);

      dispatch(updateOrder(res.data));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得訂單失敗",
          success: false,
        }),
      );
      throw error;
    }
  },
);

export const createAsyncSubmitForm = createAsyncThunk(
  "order/createAsyncSubmitForm",
  async (form, { dispatch }) => {
    dispatch(updateLoading(true));
    try {
      const res = await axios.post(`${VITE_APP_API_BASE}/api/order`, form);
      dispatch(
        createAsyncMessage({
          message: "送出訂單成功",
          success: true,
        }),
      );

      dispatch(updateOrderId(res.data.orderId));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "送出訂單失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(createAsyncGetCart());
      dispatch(updateLoading(false));
    }
  },
);

// 只標記為已付款，沒有串接金流（見 spec 的 POST /api/pay/{id}）
export const createAsyncPayOrder = createAsyncThunk(
  "order/createAsyncPayOrder",
  async (orderId, { dispatch }) => {
    dispatch(updateLoading(true));
    try {
      const res = await axios.post(`${VITE_APP_API_BASE}/api/pay/${orderId}`);
      dispatch(
        createAsyncMessage({
          message: res.data.message,
          success: true,
        }),
      );
      await dispatch(createAsyncGetOrder(orderId));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "付款失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const { updateOrder, updateOrderId, updateLoading } = orderSlice.actions;
export default orderSlice.reducer;
