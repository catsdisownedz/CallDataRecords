package org.example.msbackend.consumer;

import org.example.msbackend.database.entity.CDR;
import org.example.msbackend.database.service.CDRService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class CDRConsumer {

    private static final Logger logger = LoggerFactory.getLogger(CDRConsumer.class);
    private final CDRService cdrService;

    public CDRConsumer(CDRService cdrService) {
        this.cdrService = cdrService;
    }

    @KafkaListener(topics = "cdr-topic", groupId = "backend-group", containerFactory = "cdrKafkaListenerContainerFactory")
    public void consumeCDR(CDR cdr) {
        //Wipe the ID so Hibernate treats it as NEW, not an update
        cdr.setId(null);
        logger.info("📥 Received CDR from Kafka: {}", cdr);
        cdrService.saveCDR(cdr); // store into MySQL
    }
}
