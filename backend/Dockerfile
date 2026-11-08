# 後端映像。測試由 CI 另外執行，這裡只打包。
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
# 先只複製建置設定並下載依賴，原始碼變動時可以沿用這一層的快取
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests && cp target/backend-*.jar /src/app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 10001 app
WORKDIR /app
COPY --from=build /src/app.jar app.jar
# 上傳的圖片，compose 以 volume 掛載
RUN mkdir uploads && chown app:app uploads
USER app
ENV UPLOAD_DIR=/app/uploads
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
