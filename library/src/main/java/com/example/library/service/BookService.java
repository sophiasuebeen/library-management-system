package com.example.library.service;

import java.util.ArrayDeque;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;

import com.example.library.model.Book;
import com.example.library.repository.BookRepository;

@Service
public class BookService {
    private final BookRepository bookRepository;
    private final ArrayDeque<Runnable> undoHistory = new ArrayDeque<>();

    public BookService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }
    
    public void updateDetails(int id, String title, String author) {
        Book book = bookRepository.getBookById(id)
                .orElseThrow(() -> new NoSuchElementException("Book not found with ID: " + id));
        String oldTitle = book.getTitle();
        String oldAuthor = book.getAuthor();

        if (bookRepository.updateDetails(id, title, author) != 1) {
            throw new IllegalStateException("Failed to update book details.");
        }

        // Save the reverse action only after the update succeeds.
        undoHistory.push(() -> {
            if (bookRepository.updateDetails(id, oldTitle, oldAuthor) != 1) {
                throw new IllegalStateException("Failed to undo book update.");
            }
        });
    }

    public boolean undoLastAction() {
        if (undoHistory.isEmpty()) {
            return false;
        }
        Runnable lastAction = undoHistory.peek();
        lastAction.run();

        undoHistory.pop();
        return true;
    }

}
