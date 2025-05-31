package org.example.msbackend.database.controller;

import org.example.msbackend.keycloak.KeycloakService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;

@RestController
@RequestMapping("/api/signup")
public class SignupController {

    @Autowired
    private KeycloakService keycloakService;

    @PostMapping
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null || username.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body("❌ Username and password are required.");
        }

        try {
            keycloakService.createUser(username, password);

            Path csv = Paths.get("data/users.csv"); // relative to working dir
            Files.createDirectories(csv.getParent());
            String line = String.format("%s,%s%n", username, password);
            Files.write(csv, line.getBytes(UTF_8), StandardOpenOption.CREATE, StandardOpenOption.APPEND);

            Map<String, String> tokens = keycloakService.getUserToken(username, password);
            return ResponseEntity.ok(tokens);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("❌ Failed to signup: " + e.getMessage());
        }
    }
}
