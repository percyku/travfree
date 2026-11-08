// 依 docs/openapi.yaml 檢查測試中的 API 請求與回應，做法與後端的契約測試相同。
// 用 api.get/post/put/delete 定義 MSW handler：
//   - 路徑與方法必須在 spec 裡，否則定義時就丟錯
//   - 前端送出的 body 必須符合 requestBody schema
//   - 需要 AdminToken 的端點必須帶 Authorization header
//   - 測試假資料必須符合該狀態碼的回應 schema
// 不符合的項目記在 violations，setup.js 會在每個測試結束時檢查並讓測試失敗。
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { http, HttpResponse } from "msw";

export const API_BASE = import.meta.env.VITE_APP_API_BASE;

const specText = readFileSync(process.env.OPENAPI_SPEC, "utf8");
const spec = await $RefParser.dereference(parse(specText));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("int32", true);
ajv.addFormat("int64", true);
ajv.addFormat("binary", true);

/** OpenAPI 3.0 的 nullable 轉成 JSON Schema 的 type 陣列 */
const toJsonSchema = (schema) => {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "nullable" || key === "example") continue;
    out[key] = toJsonSchema(value);
  }
  if (schema.nullable === true && schema.type) {
    out.type = [schema.type, "null"];
  }
  return out;
};

const validators = new WeakMap();
const validate = (schema, data) => {
  if (!validators.has(schema)) {
    validators.set(schema, ajv.compile(toJsonSchema(schema)));
  }
  const fn = validators.get(schema);
  return fn(data) ? null : ajv.errorsText(fn.errors, { dataVar: "body" });
};

const jsonSchemaOf = (node) => node?.content?.["application/json"]?.schema;

const requiresAdmin = (operation) => {
  const security = operation.security ?? spec.security ?? [];
  return (
    security.length > 0 &&
    security.every((option) => Object.keys(option).length > 0)
  );
};

export const violations = [];

const define = (method, path, resolver) => {
  const operation = spec.paths[path]?.[method];
  if (!operation) {
    throw new Error(`spec 沒有 ${method.toUpperCase()} ${path}`);
  }
  const label = `${method.toUpperCase()} ${path}`;
  const mswPath = API_BASE + path.replace(/\{(\w+)\}/g, ":$1");

  return http[method](mswPath, async ({ request, params }) => {
    if (requiresAdmin(operation) && !request.headers.get("authorization")) {
      violations.push(`${label}：需要 admin token，但請求沒有 Authorization`);
    }

    let body;
    const requestSchema = jsonSchemaOf(operation.requestBody);
    const multipartSchema =
      operation.requestBody?.content?.["multipart/form-data"]?.schema;
    if (multipartSchema) {
      body = await request.formData();
      for (const name of multipartSchema.required ?? []) {
        if (!body.has(name)) {
          violations.push(`${label} 請求不符合 spec：缺少 multipart 欄位 ${name}`);
        }
      }
    } else if (requestSchema) {
      const text = await request.text();
      body = text ? JSON.parse(text) : undefined;
      const error = validate(requestSchema, body);
      if (error) violations.push(`${label} 請求不符合 spec：${error}`);
    }

    const { status = 200, json, headers } =
      (await resolver({ request, params, body })) ?? {};
    const response =
      operation.responses[String(status)] ?? operation.responses.default;
    const responseSchema = jsonSchemaOf(response);
    if (!responseSchema) {
      violations.push(`${label}：spec 沒有定義 ${status} 回應`);
    } else {
      const error = validate(responseSchema, json);
      if (error) {
        violations.push(`${label} ${status} 測試假資料不符合 spec：${error}`);
      }
    }
    return HttpResponse.json(json, { status, headers });
  });
};

/** 依 spec 路徑（例如 `/api/cart/{id}`）定義 handler，resolver 回傳 `{ status, json }` */
export const api = {
  get: (path, resolver) => define("get", path, resolver),
  post: (path, resolver) => define("post", path, resolver),
  put: (path, resolver) => define("put", path, resolver),
  delete: (path, resolver) => define("delete", path, resolver),
};

/** 失敗回應的簡寫 */
export const failure = (status, message) => ({
  status,
  json: { success: false, message },
});
