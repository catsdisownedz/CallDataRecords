package org.example.msloader.database.service;

import org.example.msloader.database.config.ApplicationContextProvider;

public class ServiceAccessUtil {

    public static CDRService getCdrService() {
        return ApplicationContextProvider.getApplicationContext().getBean(CDRService.class);
    }

    public static UserService getUserService() {
        return ApplicationContextProvider.getApplicationContext().getBean(UserService.class);
    }
}

