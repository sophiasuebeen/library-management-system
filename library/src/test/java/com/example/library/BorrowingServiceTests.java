package com.example.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.concurrent.CountDownLatch;
import java.util.NoSuchElementException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import com.example.library.controller.BorrowingController;
import com.example.library.repository.BookRepository;
import com.example.library.repository.BorrowingRepository;
import com.example.library.service.BorrowingService;

@SpringJUnitConfig(BorrowingServiceTests.Config.class)
class BorrowingServiceTests {
    @Autowired BorrowingService service;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void resetDatabase() {
        jdbc.execute("DROP TABLE IF EXISTS borrowings");
        jdbc.execute("DROP TABLE IF EXISTS books");
        jdbc.execute("DROP TABLE IF EXISTS students");
        jdbc.execute("CREATE TABLE students (id INT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE books (id INT PRIMARY KEY, available_copies INT NOT NULL)");
        jdbc.execute("""
            CREATE TABLE borrowings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL REFERENCES students(id),
                book_id INT NOT NULL REFERENCES books(id),
                borrowed_date DATE NOT NULL,
                returned_date DATE
            )
            """);
        jdbc.update("INSERT INTO students (id) VALUES (7), (8)");
        jdbc.update("INSERT INTO books (id, available_copies) VALUES (12, 1)");
    }

    @Test
    void commitsCopyDecreaseAndBorrowingTogether() {
        assertEquals(1, service.borrow(7, 12));
        assertEquals(0, copies());
        assertEquals(1, borrowingCount());
        assertEquals(7, jdbc.queryForObject("SELECT student_id FROM borrowings", Integer.class));
    }

    @Test
    void invalidStudentRollsBackEarlierCopyDecrease() {
        assertThrows(DataIntegrityViolationException.class, () -> service.borrow(999, 12));
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void unavailableBookDoesNotCreateBorrowing() {
        jdbc.update("UPDATE books SET available_copies = 0 WHERE id = 12");
        assertThrows(IllegalStateException.class, () -> service.borrow(7, 12));
        assertEquals(0, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void missingBookDoesNotCreateBorrowing() {
        assertThrows(IllegalStateException.class, () -> service.borrow(7, 999));
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void invalidIdsDoNotChangeData() {
        assertThrows(IllegalArgumentException.class, () -> service.borrow(0, 12));
        assertThrows(IllegalArgumentException.class, () -> service.borrow(7, -1));
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void httpRequestCreatesBorrowingThroughTransactionalService() throws Exception {
        var client = MockMvcBuilders.standaloneSetup(new BorrowingController(service)).build();
        client.perform(post("/borrowings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":7,\"bookId\":12}"))
                .andExpect(status().isCreated());
        assertEquals(0, copies());
        assertEquals(1, borrowingCount());
    }

    @Test
    void httpInsertFailureReturnsConflictAndRollsBack() throws Exception {
        var client = MockMvcBuilders.standaloneSetup(new BorrowingController(service)).build();
        client.perform(post("/borrowings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":999,\"bookId\":12}"))
                .andExpect(status().isConflict());
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void httpMissingIdsReturnsBadRequestWithoutChangingData() throws Exception {
        var client = MockMvcBuilders.standaloneSetup(new BorrowingController(service)).build();
        client.perform(post("/borrowings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void onlyOneConcurrentBorrowerGetsLastCopy() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> tryBorrow(start, 7));
            var second = executor.submit(() -> tryBorrow(start, 8));
            start.countDown();
            assertEquals(1, first.get(10, TimeUnit.SECONDS) + second.get(10, TimeUnit.SECONDS));
        }
        assertEquals(0, copies());
        assertEquals(1, borrowingCount());
    }

    @Test
    void returningRestoresOneCopyAndMarksTheBorrowingReturned() {
        service.borrow(7, 12);
        int borrowingId = onlyBorrowingId();

        service.returnBook(borrowingId);

        assertEquals(1, copies());
        assertNotNull(jdbc.queryForObject("SELECT returned_date FROM borrowings WHERE id = ?",
                java.sql.Date.class, borrowingId));
        assertEquals(1, borrowingCount());
    }

    @Test
    void repeatedReturnDoesNotRestoreAnotherCopyOrChangeTheReturnDate() {
        service.borrow(7, 12);
        int borrowingId = onlyBorrowingId();
        service.returnBook(borrowingId);
        jdbc.update("UPDATE borrowings SET returned_date = '2026-01-01' WHERE id = ?", borrowingId);

        service.returnBook(borrowingId);

        assertEquals(1, copies());
        assertEquals(java.sql.Date.valueOf("2026-01-01"), jdbc.queryForObject(
                "SELECT returned_date FROM borrowings WHERE id = ?", java.sql.Date.class, borrowingId));
    }

    @Test
    void invalidAndMissingReturnIdsDoNotChangeData() {
        assertThrows(IllegalArgumentException.class, () -> service.returnBook(0));
        assertThrows(IllegalArgumentException.class, () -> service.returnBook(-1));
        assertThrows(NoSuchElementException.class, () -> service.returnBook(999));
        assertEquals(1, copies());
        assertEquals(0, borrowingCount());
    }

    @Test
    void failedCopyIncreaseRollsBackTheReturnDate() {
        service.borrow(7, 12);
        int borrowingId = onlyBorrowingId();
        // Force the second write to fail after returned_date has been set.
        jdbc.execute("ALTER TABLE books ADD CONSTRAINT test_copy_limit CHECK (available_copies <= 0)");

        assertThrows(DataIntegrityViolationException.class, () -> service.returnBook(borrowingId));

        assertEquals(0, copies());
        assertNull(jdbc.queryForObject("SELECT returned_date FROM borrowings WHERE id = ?",
                java.sql.Date.class, borrowingId));
    }

    @Test
    void simultaneousReturnsOfTheSameBorrowingRestoreOnlyOneCopy() throws Exception {
        service.borrow(7, 12);
        int borrowingId = onlyBorrowingId();
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                service.returnBook(borrowingId);
                return null;
            });
            var second = executor.submit(() -> {
                start.await();
                service.returnBook(borrowingId);
                return null;
            });
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        }
        assertEquals(1, copies());
        assertEquals(1, jdbc.queryForObject(
                "SELECT COUNT(*) FROM borrowings WHERE returned_date IS NOT NULL", Integer.class));
    }

    @Test
    void simultaneousReturnsOfDifferentBorrowingsRestoreBothCopies() throws Exception {
        jdbc.update("UPDATE books SET available_copies = 2 WHERE id = 12");
        service.borrow(7, 12);
        service.borrow(8, 12);
        var ids = jdbc.queryForList("SELECT id FROM borrowings ORDER BY id", Integer.class);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                service.returnBook(ids.get(0));
                return null;
            });
            var second = executor.submit(() -> {
                start.await();
                service.returnBook(ids.get(1));
                return null;
            });
            start.countDown();
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        }
        assertEquals(2, copies());
        assertEquals(2, jdbc.queryForObject(
                "SELECT COUNT(*) FROM borrowings WHERE returned_date IS NOT NULL", Integer.class));
    }

    private int onlyBorrowingId() {
        return jdbc.queryForObject("SELECT id FROM borrowings", Integer.class);
    }

    private int tryBorrow(CountDownLatch start, int studentId) throws InterruptedException {
        start.await();
        try {
            return service.borrow(studentId, 12);
        } catch (IllegalStateException unavailable) {
            return 0;
        }
    }

    private int copies() {
        return jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class);
    }

    private int borrowingCount() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM borrowings", Integer.class);
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableTransactionManagement
    static class Config {
        @Bean DataSource dataSource() {
            var source = new JdbcDataSource();
            source.setURL("jdbc:h2:mem:borrowing-service;MODE=MySQL;DB_CLOSE_DELAY=-1");
            return source;
        }

        @Bean JdbcTemplate jdbcTemplate(DataSource source) {
            return new JdbcTemplate(source);
        }

        @Bean JdbcTransactionManager transactionManager(DataSource source) {
            return new JdbcTransactionManager(source);
        }

        @Bean BookRepository bookRepository(JdbcTemplate jdbc) {
            return new BookRepository(jdbc);
        }

        @Bean BorrowingRepository borrowingRepository(JdbcTemplate jdbc) {
            return new BorrowingRepository(jdbc);
        }

        @Bean BorrowingService borrowingService(BookRepository books, BorrowingRepository borrowings) {
            return new BorrowingService(books, borrowings);
        }
    }
}
