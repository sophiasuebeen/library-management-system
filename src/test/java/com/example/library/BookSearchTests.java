package com.example.library;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.example.library.model.Book;
import com.example.library.service.BookSearch;

class BookSearchTests {
    @Test
    void listAndMapFindTheSameBookById() {
        Book first = new Book(12, "Atomic Habits", "James Clear");
        Book second = new Book(27, "Zero to One", "Peter Thiel");
        BookSearch search = new BookSearch(List.of(first, second));

        // Use nonsequential IDs to check that lookup uses the book's ID,
        // rather than its position in the list.
        assertSame(second, search.findByIdUsingList(27));
        assertSame(second, search.findByIdUsingMap(27));
        assertSame(first, search.findByIdUsingList(12));
        assertSame(first, search.findByIdUsingMap(12));
    }

    @Test
    void missingIdReturnsNullFromBothSearches() {
        BookSearch search = new BookSearch(List.of(
                new Book(12, "Atomic Habits", "James Clear")));

        assertNull(search.findByIdUsingList(999));
        assertNull(search.findByIdUsingMap(999));
    }

    @Test
    void emptyCatalogReturnsNullFromBothSearches() {
        BookSearch search = new BookSearch(List.of());

        assertNull(search.findByIdUsingList(12));
        assertNull(search.findByIdUsingMap(12));
    }
}
