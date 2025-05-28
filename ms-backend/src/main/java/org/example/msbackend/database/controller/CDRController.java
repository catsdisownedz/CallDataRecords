package org.example.msbackend.database.controller;

import org.example.msbackend.database.entity.CDR;
import org.example.msbackend.database.service.CDRService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class CDRController {

    @Autowired
    private CDRService cdrService;

    // ✅ Original: get all CDRs
    @GetMapping("/cdrs")
    public List<CDR> getAllCDRs() {
        return cdrService.getAllCDRs();
    }

    // ✅ Filtered: sort or serviceType filter
    @GetMapping("/cdrs/filtered")
    public List<CDR> getFilteredCDRs(@RequestParam(required = false) String sort,
                                     @RequestParam(required = false) String serviceType) {
        List<CDR> cdrs = cdrService.getAllCDRs();

        if (serviceType != null) {
            cdrs = cdrs.stream()
                    .filter(cdr -> cdr.getServiceType().equalsIgnoreCase(serviceType))
                    .collect(Collectors.toList());
        }

        if (sort != null) {
            switch (sort.toLowerCase()) {
                case "anum":
                    cdrs.sort(Comparator.comparing(cdr ->
                            cdr.getAnum() != null ? cdr.getAnum() : "", String::compareTo));
                    break;
                case "bnum":
                    cdrs.sort(Comparator.comparing(cdr ->
                            cdr.getBnum() != null ? cdr.getBnum() : "", String::compareTo));
                    break;
                case "usage":
                    cdrs.sort(Comparator.comparing(CDR::getUsage).reversed());
                    break;
            }
        }

        return cdrs;
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
