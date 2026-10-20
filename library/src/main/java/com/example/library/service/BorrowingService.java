package com.example.library.service;

import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.library.dto.BorrowingView;
import com.example.library.repository.BookRepository;
import com.example.library.repository.BorrowingRepository;

@Service
public class BorrowingService {
    private final BookRepository books;
    private final BorrowingRepository borrowings;

    public BorrowingService(BookRepository books, BorrowingRepository borrowings) {
        this.books = books;
        this.borrowings = borrowings;
    }

    @Transactional(readOnly = true)
    public List<BorrowingView> getCurrentBorrowings() {
        return borrowings.getAllBorrowings();
    }

    @Transactional
    public int borrow(int studentId, int bookId) {
        if (studentId <= 0 || bookId <= 0) { //validate
            throw new IllegalArgumentException("Student and book IDs must be positive.");
        }

        if (books.decrementAvailableCopies(bookId) != 1) { //decrement
            throw new IllegalStateException("Book does not exist or has no available copies.");
        }

        int rowsInserted = borrowings.insertBorrowing(studentId, bookId); //insert
        if (rowsInserted != 1) {
            throw new IllegalStateException("Could not create the borrowing record.");
        }

        return rowsInserted;
    } 
    // With MySQL’s InnoDB engine, conflicting updates use exclusive locks. 
    // Two transactions cannot update that book’s row simultaneously

    // Both writes commit together, or both roll back if either fails.
    @Transactional
    public void returnBook(int borrowingId) {
        if (borrowingId <= 0) {
            throw new IllegalArgumentException("Borrowing ID must be positive.");
        }

        int bookId = borrowings.findBookIdByBorrowingId(borrowingId)
                .orElseThrow(() -> new NoSuchElementException("Borrowing not found."));

        // Only the request that changes an active borrowing restores a copy.
        // Repeated or simultaneous returns of the same borrowing do nothing extra.
        if (borrowings.markReturnedIfActive(borrowingId) == 0) {
            return;
        }

        if (books.incrementAvailableCopies(bookId) != 1) {
            throw new IllegalStateException("The borrowed book could not be updated.");
        }
    }
}
