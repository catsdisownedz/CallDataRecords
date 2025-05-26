package org.example.msbackend.listener;

import org.example.msbackend.database.entity.CDR;
import org.example.msbackend.database.repository.CDRRepository;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class CDRListener {

    private final CDRRepository cdrRepository;

    public CDRListener(CDRRepository cdrRepository) {
        this.cdrRepository = cdrRepository;
    }

    @KafkaListener(topics = "cdr-topic", groupId = "backend-group", containerFactory = "cdrKafkaListenerContainerFactory")
    public void listen(CDR cdr) {
        cdrRepository.save(cdr);
        System.out.println("✅ CDR received and saved: " + cdr);
    }
}
