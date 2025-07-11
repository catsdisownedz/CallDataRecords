package org.example.msbackend.database.entity;

//import jakarta.xml.bind.annotation.XmlElement;
//import jakarta.xml.bind.annotation.XmlRootElement;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

//@XmlRootElement(name = "cdr")
@Entity
@Table(name = "cdrs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CDR {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "anum", nullable = false)
    private String anum;
    @Column(name = "bnum")
    private String bnum;
    @Column(name = "serviceType",nullable = false)
    private String serviceType;
    @Column(name = "`usage`", nullable = false)
    private double usage;
    @Column(name = "startDateTime",nullable = false)
    private String startDateTime;

    public CDR(String anum, String bnum, String serviceType, double usage, String startDateTime) {
        this.anum = anum;
        this.bnum = bnum;
        this.serviceType = serviceType;
        this.usage = usage;
        this.startDateTime = startDateTime;
    }

    public void setId(Long id) {
        this.id = id;
    }

    //@XmlElement(name = "anum")
    public String getAnum() {
        return anum;
    }

    public void setAnum(String anum) {
        this.anum = anum;
    }

    //@XmlElement(name = "bnum")
    public String getBnum() {
        return bnum;
    }

    public void setBnum(String bnum) {
        this.bnum = bnum;
    }

    //@XmlElement(name = "serviceType")
    public String getServiceType() {
        return serviceType;
    }

    public void setServiceType(String serviceType) {
        this.serviceType = serviceType;
    }

    //@XmlElement(name = "usage")
    public double getUsage() {
        return usage;
    }

    public void setUsage(double usage) {
        this.usage = usage;
    }

    //@XmlElement(name = "startDateTime")
    public String getStartDateTime() {
        return startDateTime;
    }

    public void setStartDateTime(String startDateTime) {
        this.startDateTime = startDateTime;
    }


//    public String toString(int index) {
//        return(Color.colorText("\nCDR number (" + index + ")\n", Color.underline) +
//                Color.colorText("   Anum: ", Color.baby_blue) + anum + '\n' +
//                Color.colorText("   Bnum: ", Color.lavender) + bnum + '\n' +
//                Color.colorText("   Service: " , Color.baby_pink)+ serviceType + '\n' +
//                Color.colorText("   Date: ", Color.grey) + startDateTime + '\n' +
//                Color.colorText("   Usage: ", Color.orange) + usage +
//                "\n-------");
//    }
}
