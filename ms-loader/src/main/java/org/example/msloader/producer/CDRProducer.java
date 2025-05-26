package org.example.msloader.producer;

import org.example.msloader.database.entity.CDR;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class CDRProducer {

    private static final Logger logger = LoggerFactory.getLogger(CDRProducer.class);
    private final KafkaTemplate<String, CDR> kafkaTemplate;
    private final String topicName = "cdr-topic";

    public CDRProducer(KafkaTemplate<String, CDR> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendCDR(CDR cdr) {
        kafkaTemplate.send(topicName, cdr);
        logger.info("📤 Sent CDR to Kafka topic '{}': {}", topicName, cdr);
    }
}
