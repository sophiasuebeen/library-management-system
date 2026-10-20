package com.example.library.controller; //this gives your class a namespace, like a folder address for java classes

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import com.example.library.model.Book;
import com.example.library.repository.BookRepository;
import com.example.library.service.BookService;

@RestController // this class handles web requests and returns response data
public class BookController {
    private final BookRepository repository;
    private final BookService bookService;

    public BookController(BookRepository repository, BookService bookService) {
        this.repository = repository;
        this.bookService = bookService;
    }

    @GetMapping("/books")
    public List<Book> listBooks(@RequestParam(name = "title", required = false) String title) {
        return title == null ? repository.getAllBooks()
                : repository.searchByTitle(requireText(title, "Title"));
    }

    @GetMapping("/books/{id}")
    public Book getBook(@PathVariable("id") int id) {
        requirePositiveId(id);
        return repository.getBookById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found."));
    }

    @PostMapping("/books")
    public ResponseEntity<Void> addBook(@RequestBody BookRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book details are required.");
        }
        String title = requireText(request.title(), "Title");
        String author = requireText(request.author(), "Author");
        requireCopies(request.copies());
        repository.addBook(title, author, request.copies());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PatchMapping("/books/{id}/copies")
    public ResponseEntity<Void> updateCopies(@PathVariable("id") int id,
            @RequestBody CopiesRequest request) {
        requirePositiveId(id);
        requireCopies(request == null ? null : request.copies());
        if (repository.updateCopies(id, request.copies()) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found.");
        }
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/books/{id}")
    public ResponseEntity<Void> updateDetails(@PathVariable("id") int id,
            @RequestBody BookDetailsRequest request) {

        requirePositiveId(id);
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book details are required.");
        }

        String title = requireText(request.title(), "Title");
        String author = requireText(request.author(), "Author");

        try {
            bookService.updateDetails(id, title, author);
        } catch (NoSuchElementException e) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, e.getMessage(), e);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, e.getMessage(), e);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/books/undo")
    public ResponseEntity<Void> undoLastAction() {
        try {
            if (!bookService.undoLastAction()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "Nothing to undo.");
            }
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, e.getMessage(), e);
        }

        return ResponseEntity.noContent().build();

    }

    @DeleteMapping("/books/{id}")
    public ResponseEntity<Void> deleteBook(@PathVariable("id") int id) {
        requirePositiveId(id);
        try {
            if (repository.deleteBook(id) == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found.");
            }
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete a book referenced by borrowing history.", e);
        }
        return ResponseEntity.noContent().build();
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required.");
        }
        String text = value.strip();
        if (text.codePointCount(0, text.length()) > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be at most 255 characters.");
        }
        return text;
    }

    private static void requirePositiveId(int id) {
        if (id <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book ID must be positive.");
        }
    }

    private static void requireCopies(Integer copies) {
        if (copies == null || copies < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Copies must be a nonnegative integer.");
        }
    }

    public record BookRequest(String title, String author, Integer copies) {
    }

    public record BookDetailsRequest(String title, String author) {
    }

    public record CopiesRequest(Integer copies) {
    }
}
