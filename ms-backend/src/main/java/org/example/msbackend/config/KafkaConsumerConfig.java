package org.example.msbackend.config;

import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.common.TopicPartition;
import org.example.msbackend.database.entity.CDR;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.listener.ConsumerAwareRebalanceListener;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

@EnableKafka
@Configuration
public class KafkaConsumerConfig {

    @Bean
    public ConsumerFactory<String, CDR> consumerFactory() {
        // JSON deserializer for your CDR class
        JsonDeserializer<CDR> deserializer = new JsonDeserializer<>(CDR.class);
        deserializer.addTrustedPackages("*");
        deserializer.setRemoveTypeHeaders(false);
        deserializer.setUseTypeMapperForKey(true);

        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "kafka:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "backend-group");              // default group
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");         // <<< start from earliest if no offset
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, deserializer);

        return new DefaultKafkaConsumerFactory<>(
                props,
                new StringDeserializer(),
                deserializer
        );
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, CDR> cdrKafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, CDR> factory =
                new ConcurrentKafkaListenerContainerFactory<>();

        factory.setConsumerFactory(consumerFactory());

        // <— this forces every rebalance (including at startup) to read from beginning
        factory.getContainerProperties()
                .setConsumerRebalanceListener(new ConsumerAwareRebalanceListener() {
                    @Override
                    public void onPartitionsAssigned(Consumer<?,?> consumer,
                                                     Collection<TopicPartition> partitions) {
                        consumer.seekToBeginning(partitions);
                    }
                });

        return factory;
    }
}
