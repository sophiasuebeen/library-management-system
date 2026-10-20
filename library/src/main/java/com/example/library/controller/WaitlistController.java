package com.example.library.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.library.repository.BookRepository;
import com.example.library.repository.StudentRepository;
import com.example.library.service.BookWaitlist;

// Todo: How does the dependency work in java?
//- import.com.example.library.model.Book
//- we don't need this?

@RestController
@RequestMapping("/books/{bookId}/waitlist")
public class WaitlistController {

    // Spring supplies these shared objects through the constructor.
    // Importing a class makes its name available; it does not create an object.
    private final BookWaitlist waitlist;
    private final BookRepository bookRepository;
    private final StudentRepository studentRepository;

    public WaitlistController(
            BookWaitlist waitlist,
            BookRepository bookRepository,
            StudentRepository studentRepository) {
        this.waitlist = waitlist;
        this.bookRepository = bookRepository;
        this.studentRepository = studentRepository;
    }

    // Todo: understand the mechanism of private, final
    // - why use private sometimes,
    // - how do we access hashmap in the BookWaitlist.java

    // Todo: figure out what's REST and all this syntax stuff
    // - annotation tell Spring how to handle requests
    // - <> describes what your response contains
    // - “Call this method when a matching HTTP POST request arrives.”
    /*
     * e.g.
     * frontend sends
     * POST /books/12/waitlist, Content-Type: application/json {"studentId": 7}
     *
     * controllr has
     *
     * @RequestMapping("/books/{bookId}/waitlist")
     */

    // Todo: matching -> is this like type checking, functional programming?
    // 


    // Question: what's a path variable? logical flow of finding out what pv i need
    // - pv : value taken from the url
    //      e.g. bookId from @RequestMapping("/books/{bookId}/waitlist")


    // Spring converts the JSON request body into this record.
    public record JoinWaitlistRequest(int studentId) {}

    // Spring converts this response record into JSON.
    public record NextStudentResponse(int studentId) {}

    @PostMapping //no path means use the base path directly
    public ResponseEntity<Void> join(
            @PathVariable("bookId") int bookId,
            @RequestBody JoinWaitlistRequest request) {
        requirePositiveBookId(bookId);
        if (request == null || request.studentId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Student ID must be positive.");
        }

        int availableCopies = bookRepository.findAvailableCopiesById(bookId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Book not found."));

        if (studentRepository.findById(request.studentId()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found.");
        }

        if (availableCopies != 0) { 
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Join the waitlist only when the book has no available copies.");
        }

        // The service owns the private map and prevents duplicate entries.
        waitlist.join(bookId, request.studentId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/next")
    public ResponseEntity<NextStudentResponse> peekNext( @PathVariable("bookId") int bookId) {
        requireExistingBook(bookId);
        Integer studentId = waitlist.peekNext(bookId);
        if (studentId == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(new NextStudentResponse(studentId));
    }

    // This only removes a queue entry. It does not borrow or return a book.
    // POST represents consuming the next entry; repeating it can remove another student.
    @PostMapping("/next/remove")
    public ResponseEntity<Void> removeNext(@PathVariable("bookId") int bookId) {
        requireExistingBook(bookId);
        waitlist.removeNext(bookId);
        return ResponseEntity.noContent().build();
    }
    

    private static void requirePositiveBookId(int bookId) {
        if (bookId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Book ID must be positive.");
        }
    }

    private void requireExistingBook(int bookId) {
        requirePositiveBookId(bookId);
        if (bookRepository.getBookById(bookId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found.");
        }
    }
}
