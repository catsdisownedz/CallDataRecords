package org.example.msbackend.keycloak;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
public class KeycloakService {

    private final String KEYCLOAK_URL = "http://keycloak:8081";
    private final String REALM = "cdr-realm";
    private final String ADMIN_USERNAME = "admin";
    private final String ADMIN_PASSWORD = "admin";
    private final String CLIENT_ID = "cdr-frontend";

    public void createUser(String username, String password) {
        String adminToken = getAdminToken();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(adminToken);

        Map<String, Object> payload = new HashMap<>();
        payload.put("username", username);
        payload.put("enabled", true);
        payload.put("emailVerified", true);
        payload.put("email", username + "@example.com"); // or whatever
        payload.put("requiredActions", Collections.emptyList());
        payload.put("firstName", username);
        payload.put("lastName", "User");
        payload.put("credentials", Collections.singletonList(
                Map.of("type", "password", "value", password, "temporary", false)

        ));



        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        RestTemplate restTemplate = new RestTemplate();

        try {
            restTemplate.postForEntity(
                    KEYCLOAK_URL + "/admin/realms/" + REALM + "/users",
                    request,
                    String.class
            );
        } catch (HttpClientErrorException.Conflict e) {
            throw new RuntimeException("❌ Username already exists.");
        } catch (Exception e) {
            throw new RuntimeException("❌ Error creating user in Keycloak: " + e.getMessage());
        }
    }

    public Map<String, String> getUserToken(String username, String password) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        String body = "client_id=" + CLIENT_ID +
                "&username=" + username +
                "&password=" + password +
                "&grant_type=password";

        HttpEntity<String> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.postForEntity(
                KEYCLOAK_URL + "/realms/" + REALM + "/protocol/openid-connect/token",
                request,
                Map.class
        );

        Map<String, String> tokens = new HashMap<>();
        tokens.put("access_token", (String) response.getBody().get("access_token"));
        tokens.put("refresh_token", (String) response.getBody().get("refresh_token"));
        return tokens;
    }

    private String getAdminToken() {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        String body = "client_id=admin-cli" +
                "&username=" + ADMIN_USERNAME +
                "&password=" + ADMIN_PASSWORD +
                "&grant_type=password";

        HttpEntity<String> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.postForEntity(
                KEYCLOAK_URL + "/realms/master/protocol/openid-connect/token",
                request,
                Map.class
        );

        return (String) response.getBody().get("access_token");
    }
}
