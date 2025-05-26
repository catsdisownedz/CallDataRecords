package org.example.msbackend.database.controller;

import org.example.msbackend.keycloak.KeycloakService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
