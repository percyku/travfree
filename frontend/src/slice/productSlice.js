import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { createAsyncMessage } from "./messageSlice";
import axios from "axios";
const { VITE_APP_API_BASE, VITE_APP_API_PATH } = import.meta.env;

export const productSlice = createSlice({
  name: "product",
  initialState: {
    product: {},
    //for test single product
    // product: {
    //   category: "亞洲",
    //   content: "在7月左右，會湧入大量光觀客，記得要補充水分和防曬",
    //   description:
    //     "東京熱，是日本最大的首都，具有良好的治安和方便的交通系統．真的很熱喔～",
    //   id: "-OjnTAt5hrvZ7QWK1zgR",
    //   imageUrl:
    //     "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?q=80&w=1472&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    //   imagesUrl: [
    //     "https://images.unsplash.com/photo-1503899036084-c5…xMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    //   ],
    //   is_enabled: 1,
    //   origin_price: 60000,
    //   price: 30000,
    //   title: "東京5日遊",
    //   unit: "台幣",
    // },
    products: [],
    categories: [],
    pagination: {
      total_pages: 0,
      current_page: 0,
      has_pre: false,
      has_next: false,
      category: "",
    },
    tempPage: 0,
    tempCategory: "all",
    isLoading: false,
  },
  reducers: {
    updateProduct(state, action) {
      state.product = action.payload || {
        category: "",
        content: "",
        description: "",
        id: "-",
        imageUrl: "",
        imagesUrl: [],
        is_enabled: 0,
        origin_price: 0,
        price: 0,
        title: "",
        unit: "",
      };
    },
    updateProducts(state, action) {
      state.products = action.payload.products || [];
      state.pagination = action.payload.pagination || {
        total_pages: 0,
        current_page: 0,
        has_pre: false,
        has_next: false,
        category: "",
      };
      state.isLoading = false;
    },
    updateSearchProducts(state, action) {
      state.products = action.payload || [];
    },
    updateCategories(state, action) {
      state.categories = action.payload || [];
    },
    updateLoading(state, action) {
      state.isLoading = action.payload || false;
    },
    updateTempInfo(state, action) {
      state.tempCategory = action.payload.tempCategory || "all";
      state.tempPage = action.payload.tempPage || 0;
    },
  },
});

export const createAsyncGetAllProducts = createAsyncThunk(
  "product/createAsyncGetAllProducts",
  async (_, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/products/all`,
      );
      const result = [
        "all",
        ...new Set(res.data.products.map((item) => item.category)),
      ];
      dispatch(updateCategories(result));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得商品失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncGetSearchProducts = createAsyncThunk(
  "product/createAsyncGetSearchProducts",
  async (search, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      dispatch(updateSearchProducts());
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/products/all`,
      );
      const result = res.data.products.filter(
        (product) =>
          product.title.includes(search) || product.category.includes(search),
      );

      dispatch(updateSearchProducts(result));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得商品失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncGetProducts = createAsyncThunk(
  "product/createAsyncGetProducts",
  async ({ page, category }, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/products`,
        {
          params: {
            page,
            category: category === "all" ? null : category,
          },
        },
      );
      dispatch(updateProducts(res.data));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得商品失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const createAsyncGetProduct = createAsyncThunk(
  "product/createAsyncGetProduct",
  async (id, { dispatch }) => {
    try {
      dispatch(updateLoading(true));
      dispatch(updateProduct());
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/product/${id}`,
      );
      dispatch(updateProduct(res.data.product));
    } catch (error) {
      dispatch(
        createAsyncMessage({
          message: error.response?.data?.message || "取得商品失敗",
          success: false,
        }),
      );
      throw error;
    } finally {
      dispatch(updateLoading(false));
    }
  },
);

export const {
  updateProduct,
  updateProducts,
  updateSearchProducts,
  updateCategories,
  updateLoading,
  updateTempInfo,
} = productSlice.actions;
export default productSlice.reducer;
