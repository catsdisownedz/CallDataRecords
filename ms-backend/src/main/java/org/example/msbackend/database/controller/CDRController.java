package org.example.msbackend.database.controller;

import org.example.msbackend.database.entity.CDR;
import org.example.msbackend.database.service.CDRService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class CDRController {

    @Autowired
    private CDRService cdrService;

    @GetMapping("/cdrs")
    public List<CDR> getAllCDRs() {
        return cdrService.getAllCDRs();
    }

    @PostMapping("/cdrs")
    public CDR createCDR(@RequestBody CDR cdr) {
        return cdrService.saveCDR(cdr);
    }

    @GetMapping("/cdrs/aggregated")
    public Map<String, Long> getAggregatedUsage() {
        List<CDR> allCDRs = cdrService.getAllCDRs();

        return allCDRs.stream()
                .collect(Collectors.groupingBy(
                        cdr -> cdr.getServiceType().toLowerCase(),
                        Collectors.counting()
                ));
    }

}
