# FreeTrav 前端

Vite 7 + React 19 + Redux Toolkit + React Router 7 + Bootstrap 5 + axios。共用規則與 API 契約見根目錄的 `CLAUDE.md`。

## 常用指令

```bash
npm run dev                                             # 連本機後端（.env.local 的預設值）
VITE_APP_API_BASE=http://localhost:4010 npm run dev      # 連 mock server（先在根目錄 npm run openapi:mock）
```

環境變數會優先於 `.env.local`。`.env.local` 不在 git 裡，新環境需要自行建立，欄位見 `../docs/README.md`。

## 開發原則

- **只依 `../docs/openapi.yaml` 開發**，不讀後端程式碼來推測 API。
- spec 沒寫或寫得不清楚時，不要自行猜測，應該提出 spec 修改，由後端確認後再實作。
- 後端還沒完成的 API 先接 mock server。mock 回的是依 schema 產生的假資料，不會保存狀態。
- 留意 spec 標明的時間單位：訂單與優惠券是秒，登入的 `expired` 是毫秒。
- 已知的前端 bug 列在 `../docs/ARCHITECTURE.md` 的已知限制，可以著手修正，修正後從清單移除。
