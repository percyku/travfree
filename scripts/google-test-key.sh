#!/usr/bin/env bash
# E2E 用的「假 Google」金鑰：產生 RSA 金鑰對，私鑰寫到 e2e/.google-test-key.pem（不進 git），
# 公鑰（base64 的 X.509，不含 BEGIN/END）印到 stdout，給後端的 GOOGLE_TEST_PUBLIC_KEY。
# Playwright 以私鑰簽出 Google 格式的 ID token，後端用公鑰驗證，不連 Google。每次執行都重新產生。
#   GOOGLE_TEST_PUBLIC_KEY=$(scripts/google-test-key.sh)
set -euo pipefail
key="$(cd "$(dirname "$0")/.." && pwd)/e2e/.google-test-key.pem"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$key" 2>/dev/null
chmod 600 "$key"
openssl pkey -in "$key" -pubout | grep -v -- '-----' | tr -d '\n'
