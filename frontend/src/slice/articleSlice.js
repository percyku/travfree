import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
const { VITE_APP_API_BASE, VITE_APP_API_PATH } = import.meta.env;
export const articleSlice = createSlice({
  name: "article",
  initialState: {
    article: {},
    articles: [],
    isLoading: false,
  },
  //actions
  reducers: {
    updateArticle(state, action) {
      state.article = action.payload || {};
    },

    updateArticles(state, action) {
      state.articles = action.payload || [];

      state.isLoading = false;
    },
    updateLoading(state, action) {
      state.isLoading = action.payload || false;
    },
  },
});

export const createAsyncGetArticles = createAsyncThunk(
  "article/createAsyncGetArticles",
  async (_, { dispatch }) => {
    try {
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/articles`,
      );

      dispatch(updateArticles(res.data.articles));
    } catch (error) {
      console.log(error.response?.data?.message || "取得文章失敗");
      throw error;
    }
  },
);

export const createAsyncGetArticle = createAsyncThunk(
  "article/createAsyncGetArticle",
  async (id, { dispatch }) => {
    try {
      dispatch(updateArticle());
      const res = await axios.get(
        `${VITE_APP_API_BASE}/api/${VITE_APP_API_PATH}/article/${id}`,
      );

      dispatch(updateArticle(res.data.article));
    } catch (error) {
      console.log(error.response?.data?.message || "取得文章失敗");
      throw error;
    }
  },
);

export const { updateArticle, updateArticles, updateLoading } =
  articleSlice.actions;
export default articleSlice.reducer;
