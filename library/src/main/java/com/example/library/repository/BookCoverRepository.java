package com.example.library.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Stores uploaded covers in the database, because the host's disk is wiped on every deploy.
 *
 * This uses JDBC instead of a JPA entity on purpose: ddl-auto=validate only checks entity
 * tables, so a server whose book_covers table is missing still starts and serves /books.
 */
@Repository
public class BookCoverRepository {
    private final JdbcTemplate jdbc;

    public BookCoverRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Lists which books have covers without reading any image bytes. */
    public List<CoverVersion> listVersions() {
        return jdbc.query("SELECT book_id, version FROM book_covers ORDER BY book_id",
                (row, index) -> new CoverVersion(row.getInt("book_id"), row.getLong("version")));
    }

    public Optional<StoredCover> find(int bookId) {
        return jdbc.query("SELECT content_type, image, version FROM book_covers WHERE book_id = ?",
                (row, index) -> new StoredCover(row.getString("content_type"), row.getBytes("image"),
                        row.getLong("version")),
                bookId).stream().findFirst();
    }

    public void save(int bookId, String contentType, byte[] image, long version) {
        jdbc.update("""
                INSERT INTO book_covers (book_id, content_type, image, version)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE content_type = VALUES(content_type),
                    image = VALUES(image), version = VALUES(version)
                """, bookId, contentType, image, version);
    }

    public int delete(int bookId) {
        return jdbc.update("DELETE FROM book_covers WHERE book_id = ?", bookId);
    }

    public record CoverVersion(int bookId, long version) {
    }

    public record StoredCover(String contentType, byte[] image, long version) {
    }
}
