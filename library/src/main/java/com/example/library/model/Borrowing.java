package com.example.library.model;

import java.time.LocalDate;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SourceType;

@Entity
@Table(name = "borrowings")
public class Borrowing {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    // Borrowings reference existing students/books; never cascade their deletion.
    // ManyToOne: Many borrowing records can reference one student.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false) // “Use the student_id column in the borrowings table to reference the student’s primary key.”
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @CreationTimestamp(source = SourceType.DB)
    @Column(name = "borrowed_date", nullable = false, updatable = false)
    private LocalDate borrowedDate;

    @Column(name = "returned_date")
    private LocalDate returnedDate;

    protected Borrowing() {}

    public Borrowing(Student student, Book book) {
        this.student = student;
        this.book = book;
    }

    public int getId() { return id; }
    public Student getStudent() { return student; }
    public Book getBook() { return book; }
    public LocalDate getBorrowedDate() { return borrowedDate; }
    public LocalDate getReturnedDate() { return returnedDate; }
}
