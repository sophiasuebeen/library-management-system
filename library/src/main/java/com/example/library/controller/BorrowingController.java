package com.example.library.controller;

import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.library.dto.BorrowingView;
import com.example.library.service.BorrowingService;

@RestController
@RequestMapping("/borrowings")
public class BorrowingController {
    private final BorrowingService service;

    public BorrowingController(BorrowingService service) {
        this.service = service;
    }

    @GetMapping
    public List<BorrowingView> getCurrentBorrowings() {
        return service.getCurrentBorrowings();
    }

    @PostMapping
    public ResponseEntity<Void> borrow(@RequestBody BorrowRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Borrowing details are required.");
        }

        try {
            service.borrow(request.studentId(), request.bookId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage(), e);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Borrowing could not be saved. Check that the student and book exist.", e);
        }

        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // The class-level mapping already supplies /borrowings.
    @PatchMapping("/{borrowingId}/return")
    public ResponseEntity<Void> returnBook(@PathVariable("borrowingId") int borrowingId) {
        try {
            service.returnBook(borrowingId);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        } catch (NoSuchElementException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage(), e);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage(), e);
        }

        return ResponseEntity.noContent().build();
    }

    public record BorrowRequest(int studentId, int bookId) {
        

    }
}
