import { combineReducers, configureStore } from "@reduxjs/toolkit";
import messageReducer from "../slice/messageSlice";
import productReducer from "../slice/productSlice";
import articleReducer from "../slice/articleSlice";
import cartReducer from "../slice/cartSlice";
import orderReducer from "../slice/orderSlice";

const rootReducer = combineReducers({
  message: messageReducer,
  product: productReducer,
  article: articleReducer,
  cart: cartReducer,
  order: orderReducer,
});

/** 建立新的 store。測試每次都用新的 store，避免狀態互相影響 */
export const makeStore = (preloadedState) =>
  configureStore({ reducer: rootReducer, preloadedState });

export const store = makeStore();

export default store;
