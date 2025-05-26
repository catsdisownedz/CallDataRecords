# ---- Stage 1: Build the Spring Boot JAR ----
FROM gradle:8.5.0-jdk17 AS build
WORKDIR /app
COPY . .
RUN gradle :ms-loader:bootJar -x test --no-daemon

# ---- Stage 2: Runtime ----
FROM eclipse-temurin:17-jdk
WORKDIR /app

# Copy the fat JAR built in the previous stage
COPY --from=build /app/ms-loader/build/libs/app.jar app.jar

# Copy runtime data only (NOT application.properties anymore)
COPY data /app/data

# Expose the port Spring Boot runs on
EXPOSE 8080

# Run the application (Spring will load config from inside the JAR)
ENTRYPOINT ["java", "-jar", "app.jar"]
