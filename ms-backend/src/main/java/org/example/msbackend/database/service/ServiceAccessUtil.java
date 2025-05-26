package org.example.msbackend.database.service;

import org.example.msbackend.database.config.ApplicationContextProvider;

public class ServiceAccessUtil {

    public static CDRService getCdrService() {
        return ApplicationContextProvider.getApplicationContext().getBean(CDRService.class);
    }

    public static UserService getUserService() {
        return ApplicationContextProvider.getApplicationContext().getBean(UserService.class);
    }
}

