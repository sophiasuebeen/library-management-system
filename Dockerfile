FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm test && npm run build && npm run test:sites

FROM eclipse-temurin:25-jdk-noble AS backend
WORKDIR /build/library
COPY library/ ./
COPY --from=frontend /build/frontend/dist/client/ ./src/main/resources/static/
RUN chmod +x mvnw && ./mvnw -B -ntp verify

FROM eclipse-temurin:25-jre-noble
WORKDIR /app
RUN groupadd --system library && useradd --system --gid library --home-dir /app library
COPY --from=backend --chown=library:library /build/library/target/library-0.0.1-SNAPSHOT.jar ./library.jar
USER library
ENV SPRING_PROFILES_ACTIVE=cloud
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/library.jar"]
