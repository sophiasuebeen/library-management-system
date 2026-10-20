package com.example.library.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.example.library.model.Student;

@Repository
public class StudentRepository {
    private final JdbcTemplate jdbc;
    
    public StudentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int registerStudent(String name) {
        String sql = "INSERT INTO students (name) VALUES (?)";
        return jdbc.update(sql, name);
    }

    public List<Student> findAll() {
        String sql = "SELECT id, name FROM students ORDER BY id";
        return jdbc.query(sql, (row, rowNumber) -> new Student(
                row.getInt("id"),
                row.getString("name")));
    }

    public Optional<Student> findById(int id) {
        String sql = "SELECT id, name FROM students WHERE id = ?";
        return jdbc.query(sql, (row, rowNumber) -> new Student(
                row.getInt("id"), row.getString("name")), id).stream().findFirst();
    }

    public int updateName(int id, String name) {
        return jdbc.update("UPDATE students SET name = ? WHERE id = ?", name, id);
    }

    public int deleteStudent(int id) {
        return jdbc.update("DELETE FROM students WHERE id = ?", id);
    }
}
