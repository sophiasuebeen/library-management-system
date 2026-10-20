package com.example.library.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.example.library.model.Book;

@Repository
public class BookRepository {
    private final JdbcTemplate jdbc;

    private static final RowMapper<Book> BOOK_MAPPER =
        (row, rowNumber) -> new Book(
            row.getInt("id"),
            row.getString("title"),
            row.getString("author"),
            row.getInt("available_copies")
        );

    public BookRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Book> getAllBooks() { //TODO:
        String sql = """
            SELECT id, title, author, available_copies
            FROM books
            ORDER BY id
            """;

        return jdbc.query(sql, BOOK_MAPPER);
    }

    public Optional<Book> getBookById(int id) { //Todo: Search the list by ID
        String sql = """
            SELECT id, title, author, available_copies
            FROM books
            WHERE id = ?
            """;

        return jdbc.query(sql, BOOK_MAPPER, id)
            .stream()
            .findFirst();
    }

    public Optional<Integer> findAvailableCopiesById(int bookId) {
        return jdbc.query("SELECT available_copies FROM books WHERE id = ?",
                (row, rowNumber) -> row.getInt("available_copies"), bookId)
                .stream().findFirst();
    }

    public List<Book> searchByTitle(String title) { //Todo: Search an in-memory list by title
        String sql = """
            SELECT id, title, author, available_copies
            FROM books
            WHERE title = ?
            ORDER BY id
            """;

        return jdbc.query(sql, BOOK_MAPPER, title);
    }

    public int addBook(String title, String author, int copies) { //Todo: public Map<Integer, Book> buildBookIndex(List<Book> books)
        String sql = """
            INSERT INTO books (title, author, available_copies)
            VALUES (?, ?, ?)
            """;

        return jdbc.update(sql, title, author, copies);
    }

    public int updateDetails(int id, String title, String author) {
        String sql = "UPDATE books SET title = ?, author = ? WHERE id = ?";
        return jdbc.update(sql, title, author, id);
    }

    public int updateCopies(int id, int newCopies) {
        String sql = """
            UPDATE books
            SET available_copies = ?
            WHERE id = ?
            """;

        return jdbc.update(sql, newCopies, id);
    }

    public int decrementAvailableCopies(int bookId) {
        String sql = """
            UPDATE books
            SET available_copies = available_copies - 1
            WHERE id = ? AND available_copies > 0
            """;

        return jdbc.update(sql, bookId);
    }

    public int incrementAvailableCopies(int bookId) {
        return jdbc.update("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", bookId);
    }

    public int deleteBook(int id) {
        String sql = "DELETE FROM books WHERE id = ?";

        return jdbc.update(sql, id);
    }
}


/* When your application starts,
 * Spring scans your application package and its subpackages.
 * It discovers BookRepository, creates an object, and keeps track of it.
 * A Spring-managed object is called a bean.
 * JdbcTemplate is Spring’s helper for JDBC.
 * It handles opening and releasing database resources;
 * you still write SQL.
 * The code inside jdbc.query() converts each database row into a Book
 */
