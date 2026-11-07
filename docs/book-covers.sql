-- Adds uploaded book covers to an existing library database.
-- Run once in the `library` database (TiDB and local MySQL). Safe to run again.
-- It only creates a new table; existing books, students and borrowings are not changed.
CREATE TABLE IF NOT EXISTS book_covers (
    book_id INT PRIMARY KEY,
    content_type VARCHAR(32) NOT NULL,
    image MEDIUMBLOB NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT fk_book_covers_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
