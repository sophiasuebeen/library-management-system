package com.example.library;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;
import com.example.library.model.Book;
import com.example.library.model.Borrowing;
import com.example.library.model.Student;
import com.example.library.repository.BookRepository;
import com.example.library.repository.BorrowingRepository;
import com.example.library.repository.StudentRepository;

@SpringBootTest
@ActiveProfiles("test")
@Sql("/reset-schema.sql")
@Transactional
class JpaPersistenceTests {
    @Autowired BookRepository books;
    @Autowired StudentRepository students;
    @Autowired BorrowingRepository borrowings;
    @Autowired EntityManager entityManager;

    @Test
    void persistsGeneratedIdsRelationshipsAndDatabaseDate() {
        Book book = books.saveAndFlush(new Book("JPA Guide", "Author", 2));
        Student student = students.saveAndFlush(new Student("Sophia"));
        Borrowing borrowing = borrowings.saveAndFlush(new Borrowing(student, book));
        int id = borrowing.getId();
        assertTrue(book.getId() > 0);
        assertTrue(student.getId() > 0);
        assertTrue(id > 0);
        var databaseDate = entityManager.createQuery("select CURRENT_DATE", java.sql.Date.class)
                .getSingleResult().toLocalDate();
        entityManager.clear();

        Borrowing loaded = borrowings.findById(id).orElseThrow();
        assertEquals("Sophia", loaded.getStudent().getName());
        assertEquals("JPA Guide", loaded.getBook().getTitle());
        assertEquals(databaseDate, loaded.getBorrowedDate());
        assertNull(loaded.getReturnedDate());

        // Managed entity changes are written at flush without calling save().
        loaded.getBook().setTitle("Updated guide");
        entityManager.flush();
        entityManager.clear();
        assertEquals("Updated guide", books.findById(book.getId()).orElseThrow().getTitle());
    }

    @Test
    void stockUpdatesInvalidatePreviouslyLoadedEntities() {
        Book book = books.saveAndFlush(new Book("Concurrency", "Author", 1));
        int id = book.getId();
        assertEquals(1, books.decrementAvailableCopies(id));
        assertFalse(entityManager.contains(book));
        assertEquals(0, books.findById(id).orElseThrow().getAvailableCopies());
        assertEquals(0, books.decrementAvailableCopies(id));
    }
}
