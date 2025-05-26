package org.example.msbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "org.example.msbackend")
public class MsBackendApplication {
	public static void main(String[] args) {
		SpringApplication.run(MsBackendApplication.class, args);
	}
}
