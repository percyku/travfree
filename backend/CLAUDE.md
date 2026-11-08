# FreeTrav 後端

Spring Boot 3.5 + Java 21 + PostgreSQL。共用規則與 API 契約見根目錄的 `CLAUDE.md`，開發規範見 `../docs/DEVELOPMENT.md`。

## 常用指令

```bash
# 需要 JDK 21，系統預設不是 21
(cd .. && docker compose up -d db)   # 資料庫在根目錄的 docker-compose.yml
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw spring-boot:run   # http://localhost:8080/v2
JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test
```

## 開發流程

1. 先改 `../docs/openapi.yaml`，在根目錄執行 `npm run openapi:lint`。
2. 實作。
3. 撰寫整合測試。`ApiTestSupport` 已經匯入 `OpenApiContractConfig`，所有 MockMvc 回應都會對 spec 驗證，所以新測試只要繼承 `ApiTestSupport` 就有契約檢查。
4. 跑 `./mvnw test`。若出現 `OpenApiValidationException`，表示實作和 spec 不一致，要判斷該改哪一邊，不可以只為了讓測試通過而放寬 spec。
5. 更新 `../docs/` 的其他文件。

## 必守規則

- 修改 entity 或 JSON 欄位後，要在真實 PostgreSQL 上驗證，H2 不足以代表。
- 修改回應前，先確認前端怎麼讀。
- 回應 schema 在 spec 中標 `additionalProperties: false`。後端多回傳欄位也要先寫進 spec。
- `GET /orders` 需要 admin token，這是刻意與 Hexschool 不同的設計。
