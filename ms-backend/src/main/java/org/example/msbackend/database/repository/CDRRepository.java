package org.example.msbackend.database.repository;

import org.example.msbackend.database.entity.CDR;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CDRRepository extends JpaRepository<CDR, Long> {
    //List<CDR> findAllByOrderByStartTimeAsc();
    List<CDR> findByAnum(String anum);
    List<CDR> findByBnum(@Param("bnum") String bnum);

//    @Query("SELECT c FROM CDR c WHERE c.anum = :num OR c.bnum = :num")
//    List<CDR> findByAnumOrBnum(@Param("num") String num);

}
