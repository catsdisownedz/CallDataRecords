package org.example.msfrontend;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "org.example.msfrontend")
public class MsFrontendApplication {

	public static void main(String[] args) {
		SpringApplication.run(MsFrontendApplication.class, args);
	}

	@PostConstruct
	public void openBrowser() {
		String url = "http://localhost:8080";
		System.out.println("🌐 Launching UI at: " + url);
		try {
			if (System.getProperty("os.name").toLowerCase().contains("win")) {
				new ProcessBuilder("cmd", "/c", "start " + url).start();
			} else {
				new ProcessBuilder("xdg-open", url).start(); // For Linux/macOS
			}
		} catch (Exception e) {
			System.err.println("❌ Failed to launch browser: " + e.getMessage());
		}
	}
}
