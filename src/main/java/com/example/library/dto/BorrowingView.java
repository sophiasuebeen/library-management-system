package com.example.library.dto;

import java.time.LocalDate;

public record BorrowingView(
    int borrowingId,
    String studentName,
    String bookTitle,
    LocalDate borrowedDate
) {}


// DTO means Data Transfer Object: 
// a class or record that carries data between parts of your app.
