package com.example.library.controller;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import com.example.library.model.Student;
import com.example.library.repository.StudentRepository;

@RestController
public class StudentController{
    private final StudentRepository repository;

    public StudentController(StudentRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/students")
    public List<Student> listStudents() {
        return repository.findAll();
    }

    @PostMapping("/students")
    public ResponseEntity<Void> registerStudent(@RequestBody StudentRequest request) {
        String name = requireName(request);
        repository.registerStudent(name);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping("/students/{id}")
    public Student getStudent(@PathVariable("id") int id) {
        requirePositiveId(id);
        return repository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found."));
    }

    @PatchMapping("/students/{id}")
    public ResponseEntity<Void> updateStudent(@PathVariable("id") int id,
            @RequestBody StudentRequest request) {
        requirePositiveId(id);
        String name = requireName(request);
        if (repository.updateName(id, name) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found.");
        }
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/students/{id}")
    public ResponseEntity<Void> deleteStudent(@PathVariable("id") int id) {
        requirePositiveId(id);
        try {
            if (repository.deleteStudent(id) == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found.");
            }
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete a student referenced by borrowing history.", e);
        }
        return ResponseEntity.noContent().build();
    }

    private static void requirePositiveId(int id) {
        if (id <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student ID must be positive.");
        }
    }

    private static String requireName(StudentRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student name is required.");
        }

        String name = request.name().strip();
        if (name.codePointCount(0, name.length()) > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Student name must be at most 255 characters.");
        }

        return name;
    }

    public record StudentRequest(String name) {}
    
}



