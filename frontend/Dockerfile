# 前端映像：打包後由 nginx 提供靜態檔，並把 /v2 轉給後端
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_ 開頭的變數在建置時寫進 JS，執行時再改沒有作用。
# API 與網頁同一個網址，所以用相對路徑 /v2
ARG VITE_APP_API_BASE=/v2
ARG VITE_APP_API_COOKIE_PATH=/
ARG VITE_APP_TOKEN_NAME=freetrav-token
ENV VITE_APP_API_BASE=$VITE_APP_API_BASE \
    VITE_APP_API_COOKIE_PATH=$VITE_APP_API_COOKIE_PATH \
    VITE_APP_TOKEN_NAME=$VITE_APP_TOKEN_NAME
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
