// 第一個匯入：GitHub 等平台導回時，在路由讀取網址之前把 code 從網址移除
import "./oauthRedirect.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./assets/scss/all.scss";
import "bootstrap/dist/js/bootstrap.min.js";
import App from "./App.jsx";
import { Provider } from "react-redux";
import store from "./store/store.js";

createRoot(document.getElementById("root")).render(
  // <StrictMode>
  // <App />,
  // </StrictMode>,
  <Provider store={store}>
    <App />
  </Provider>,
);
