package com.example.library.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.example.library.model.Student;

@Transactional(readOnly = true)
public interface StudentRepository extends JpaRepository<Student, Integer> {
    @Override
    @Query("select s from Student s order by s.id")
    List<Student> findAll();

    @Transactional
    default int registerStudent(String name) {
        saveAndFlush(new Student(name));
        return 1;
    }

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Student s set s.name = :name where s.id = :id")
    int updateName(@Param("id") int id, @Param("name") String name);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Student s where s.id = :id")
    int deleteStudent(@Param("id") int id);
}
