package org.example.msfrontend.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.util.*;

@Component
public class KeycloakRealmGenerator {

    private static final String CSV_FILE = "../../data/users.csv";
    private static final String OUTPUT_JSON = "../../realms/cdr-realm.json";

    @PostConstruct
    public void generateRealmOnStartup() {
        try {
            ObjectMapper mapper = new ObjectMapper();

            ObjectNode realm = mapper.createObjectNode();
            realm.put("realm", "cdr-realm");
            realm.put("enabled", true);

            ArrayNode clients = mapper.createArrayNode();
            ObjectNode client = mapper.createObjectNode();
            client.put("clientId", "cdr-frontend");
            client.put("publicClient", true);
            client.put("standardFlowEnabled", true);
            ArrayNode redirectUris = client.putArray("redirectUris");
            redirectUris.add("http://localhost:80/*");
            redirectUris.add("http://localhost:8080/*");
            redirectUris.add("http://localhost/*");
            redirectUris.add("http://localhost:3000/*");
            client.set("redirectUris", redirectUris);
            client.putArray("webOrigins").add("*");
            clients.add(client);
            realm.set("clients", clients);

            ArrayNode users = mapper.createArrayNode();
            List<String> lines = Files.readAllLines(Paths.get(CSV_FILE));
            for (String line : lines) {
                String[] parts = line.split(",");
                if (parts.length == 2) {
                    String username = parts[0].trim();
                    String password = parts[1].trim();

                    ObjectNode user = mapper.createObjectNode();
                    user.put("username", username);
                    user.put("enabled", true);

                    ArrayNode credentials = mapper.createArrayNode();
                    ObjectNode cred = mapper.createObjectNode();
                    cred.put("type", "password");
                    cred.put("value", password);
                    cred.put("temporary", false);
                    credentials.add(cred);

                    user.set("credentials", credentials);
                    users.add(user);
                }
            }

            realm.set("users", users);

            Path outputPath = Paths.get(OUTPUT_JSON);
            Files.createDirectories(outputPath.getParent());
            mapper.writerWithDefaultPrettyPrinter().writeValue(outputPath.toFile(), realm);

            System.out.println("✅ Auto-generated cdr-realm.json with " + users.size() + " users.");

        } catch (Exception e) {
            System.err.println("❌ Failed to generate realm JSON:");
            e.printStackTrace();
        }
    }
}
