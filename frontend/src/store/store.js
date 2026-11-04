import { configureStore } from "@reduxjs/toolkit";
import messageReducer from "../slice/messageSlice";
import productReducer from "../slice/productSlice";
import articleReducer from "../slice/articleSlice";
import cartReducer from "../slice/cartSlice";
import orderReducer from "../slice/orderSlice";

export const store = configureStore({
  reducer: {
    message: messageReducer,
    product: productReducer,
    article: articleReducer,
    cart: cartReducer,
    order: orderReducer,
  },
});

export default store;
