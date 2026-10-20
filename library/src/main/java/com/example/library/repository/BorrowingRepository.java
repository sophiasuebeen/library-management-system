/*
- Borrowing Service : Coordinates the complete borrowing operation and its transaction 
- Borrowing Repository : Executes SQL to insert or retrieve borrowing records
- Book Repository: Executes SQL to decrease available copies
*/


package com.example.library.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.example.library.dto.BorrowingView;

@Repository
public class BorrowingRepository {
    private final JdbcTemplate jdbc;
    public BorrowingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<BorrowingView> getAllBorrowings() {
        String sql = """
            SELECT
                borrowings.id AS borrowing_id,
                students.name AS student_name,
                books.title AS book_title,
                borrowings.borrowed_date
            FROM borrowings
            INNER JOIN students
                ON borrowings.student_id = students.id
            INNER JOIN books
                ON borrowings.book_id = books.id
            WHERE borrowings.returned_date IS NULL
            ORDER BY borrowings.id
            """;

        return jdbc.query(sql, (row, rowNumber) -> new BorrowingView(
            row.getInt("borrowing_id"),
            row.getString("student_name"),
            row.getString("book_title"),
            row.getDate("borrowed_date").toLocalDate()
        ));
    }
    public int insertBorrowing(int studentId, int bookId) {
        String sql = """
            INSERT INTO borrowings (student_id, book_id, borrowed_date)
            VALUES (?, ?, CURDATE())
            """;

        return jdbc.update(sql, studentId, bookId);
    }

    public Optional<Integer> findBookIdByBorrowingId(int borrowingId) {
        return jdbc.query("SELECT book_id FROM borrowings WHERE id = ?",
                (row, rowNumber) -> row.getInt("book_id"), borrowingId)
                .stream().findFirst();
    }

    public int markReturnedIfActive(int borrowingId) {
        String sql = """
            UPDATE borrowings
            SET returned_date = CURDATE()
            WHERE id = ? AND returned_date IS NULL
            """;
        return jdbc.update(sql, borrowingId);
    }
}

/* public int borrow(int studentId, int bookId) throws SQLException {
        String decrementCopies = """
            UPDATE books
            SET available_copies = available_copies - 1
            WHERE id = ? AND available_copies > 0
        """;

        String insertBorrowing = "INSERT INTO borrowings (student_id, book_id, borrowed_date) VALUES (?, ?, CURDATE())";
        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false); //disable automatic commits
            try {
                try (PreparedStatement statement = conn.prepareStatement(decrementCopies)) { //prepare and execute
                    statement.setInt(1, bookId);

                    int rowsUpdated = statement.executeUpdate();
                    if (rowsUpdated == 0) {
                        throw new IllegalStateException(
                            "Book does not exist or has no available copies"
                        );
                    }
                }
                int rowsInserted;

                try (PreparedStatement statement = conn.prepareStatement(insertBorrowing)) {
                    statement.setInt(1, studentId);
                    statement.setInt(2, bookId);

                    rowsInserted = statement.executeUpdate();
                    if (rowsInserted != 1) {
                        throw new SQLException(
                            "Could not create the borrowing record"
                        );
                    }
                }
                conn.commit();
                return rowsInserted;
            } catch (SQLException | RuntimeException e) {
                try {
                    conn.rollback();
                } catch (SQLException rollbackError) {
                    e.addSuppressed(rollbackError);
                }
                throw e;
            }
        }
    } */
