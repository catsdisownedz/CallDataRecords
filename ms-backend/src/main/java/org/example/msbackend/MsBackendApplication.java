package org.example.msbackend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;


@SpringBootApplication(scanBasePackages = "org.example.msbackend")
@EnableKafka
public class MsBackendApplication {
	public static void main(String[] args) {
		SpringApplication.run(MsBackendApplication.class, args);
	}
}
