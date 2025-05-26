package org.example.msloader;

import jakarta.annotation.PostConstruct;
import org.example.msloader.database.entity.CDR;
import org.example.msloader.database.entity.User;
import org.example.msloader.database.service.*;
import org.example.msloader.display.*;
import org.example.msloader.formatters.*;
import org.example.msloader.producer.CDRProducer;
import org.example.msloader.utils.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

@SpringBootApplication(scanBasePackages = "org.example.msloader")
public class MsLoaderApplication implements CommandLineRunner {

	public static final String OUTPUT_DIR = "../cdr_output";  // root directory
	private static final Random rd = new Random();
	public static int NUM_RECORDS = rd.nextInt(100) + 100;
	private final BlockingQueue<CDR> cdrQueue = new LinkedBlockingQueue<>(NUM_RECORDS);

	@Autowired private CDRService cdrService;
	@Autowired private UserService userService;
	@Autowired private CDRProducer cdrProducer;

	public static void main(String[] args) {
		SpringApplication.run(MsLoaderApplication.class, args);
	}

	@Override
	public void run(String... args) throws Exception {
		DirectoryControls dir = new DirectoryControls();
		dir.deleteDirectory(Paths.get(OUTPUT_DIR));
		dir.createDirectory(OUTPUT_DIR);

		RandomDataGenerator randomDataGenerator = new RandomDataGenerator(
				new NameExtracter(),
				new ServiceTypeGenerator(),
				new UsageGenerator(),
				new StartDateTimeGenerator()
		);

		System.out.println("Please wait while we retrieve the " + NUM_RECORDS + " files...");
		MultiThreader multiThreader = new MultiThreader();
		CountDownLatch latch = new CountDownLatch(2); // For two tasks

		Runnable generateTask = () -> {
			try {
				for (int i = 0; i < NUM_RECORDS; i++) {
					try {
						CDR cdr = randomDataGenerator.generateRandomRecord();
						cdrQueue.put(cdr);
					} catch (Exception e) {
						i--; // retry
					}
				}
			} finally {
				latch.countDown();
			}
		};

		List<CDR> cdrList = new ArrayList<>();
		Runnable processTask = () -> {
			try {
				while (cdrList.size() < NUM_RECORDS || !cdrQueue.isEmpty()) {
					CDR cdr = cdrQueue.poll(5000, TimeUnit.MILLISECONDS);
					if (cdr != null) {
						cdrList.add(cdr);
					} else {
						System.out.println("Polling timeout occurred, queue might be empty");
					}
				}
			} catch (Exception e) {
				System.err.println("Process task was interrupted: " + e.getMessage());
				Thread.currentThread().interrupt();
			} finally {
				latch.countDown();
			}
		};

		multiThreader.runUserTask(generateTask);
		multiThreader.runUserTask(processTask);

		try {
			latch.await();
			multiThreader.shutdown();
			if (!multiThreader.executorService.awaitTermination(30, TimeUnit.SECONDS)) {
				multiThreader.executorService.shutdownNow();
			}
		} catch (InterruptedException e) {
			multiThreader.executorService.shutdownNow();
			Thread.currentThread().interrupt();
		}

		// Save and produce
		try {
			cdrService.saveAllCDRs(cdrList);
			userService.saveAllUsers(CSVFormatter.extractUsersFromCSV("data/users.csv"));
			cdrList.forEach(cdrProducer::sendCDR); // send to Kafka
			System.out.println("All " +cdrList.size() + "CDRs saved to database and sent to Kafka successfully");
		} catch (Exception e) {
			System.err.println("Error saving or sending CDRs: " + e.getMessage());
			e.printStackTrace();
		}

		BaseFormatter[] formatters = {
				new CSVFormatter(),
				new JSONFormatter(),
				new XMLFormatter(),
				new YAMLFormatter(),
		};

		String[] extensions = {".csv", ".json", ".xml", ".yaml"};
		for (int i = 0; i < formatters.length; i++) {
			String fileName = Paths.get(OUTPUT_DIR, "cdr" + extensions[i]).toString();
			formatters[i].write(fileName, cdrList);
			System.out.println("Data written into " + extensions[i].substring(1).toUpperCase() + " file.");
		}

		LoginMenu.displayRedirectingMessage();
		TerminalUtils.clearTerminal();
		if (System.console() != null) {
			new LoginMenu(formatters).display();
		} else {
			System.out.println("Skipping login menu (no interactive console available).");
		}



	}

	@PostConstruct
	public void logDatasource() {
		System.out.println("Connecting to DB: " + System.getProperty("spring.datasource.url"));
	}
}
