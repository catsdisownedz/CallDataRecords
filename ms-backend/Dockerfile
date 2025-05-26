FROM gradle:8.5.0-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle :ms-backend:bootJar -x test --no-daemon

FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY --from=build /app/ms-backend/build/libs/*.jar app.jar
COPY ms-backend/src/main/resources/application.properties /app/application.properties
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.config.location=file:/app/application.properties"]
