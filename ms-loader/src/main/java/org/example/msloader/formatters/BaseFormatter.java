package org.example.msloader.formatters;

import org.example.msloader.database.entity.CDR;

import java.util.List;

public interface BaseFormatter {
    void write(String fileName, List<CDR> records);
}
