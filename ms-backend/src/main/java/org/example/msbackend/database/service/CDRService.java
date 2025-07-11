package org.example.msbackend.database.service;

import org.example.msbackend.database.entity.CDR;
import org.example.msbackend.database.repository.CDRRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CDRService {

    @Autowired
    private CDRRepository cdrRepository;

    @Transactional
    public CDR saveCDR(CDR cdr) {
        return cdrRepository.save(cdr);
    }

    public  List<CDR> getAllCDRs() {
        return cdrRepository.findAll();
    }

    public List<CDR> getCDRsByANUM(String name) {
        return cdrRepository.findByAnum(name);
    }
    public List<CDR> getCDRsByBNUM(String name) {
        return cdrRepository.findByBnum(name);
    }
    public List<CDR> findByANUMOrBNUM(String num) {
        return cdrRepository.findByAnum(num).isEmpty() ?
                cdrRepository.findByBnum(num) :
                cdrRepository.findByAnum(num);
    }

    @Transactional
    public void saveAllCDRs(List<CDR> cdrList) {
        final int BATCH_SIZE = 100;
        int size = cdrList.size();
        for (int i = 0; i < size; i += BATCH_SIZE) {
            int end = Math.min(size, i + BATCH_SIZE);
            List<CDR> batch = cdrList.subList(i, end);
            cdrRepository.saveAll(batch);
            cdrRepository.flush();
        }
    }



}
