package com.example.library.service;

import java.util.Map;

import com.example.library.model.Book;

import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;

public class BookSearch{
    private final List<Book> books;
    private final Map<Integer, Book> booksById = new HashMap<>();

    public BookSearch(List<Book> loadedBooks){
        books = new ArrayList<>(loadedBooks);

        for (Book book : books) {
            booksById.put(book.getId(), book);
        }
    }

    public Book findByIdUsingMap(int id){
        return booksById.get(id);
    }

    public Book findByIdUsingList(int id){ //linear Search
        for(Book book: books){
            if(book.getId()==id)
                return book;
        }
        return null;
    }

    public List<Book> SortBooksByTitle(List<Book> booksToSort){ //ascending order
        booksToSort.sort((b1, b2) -> b1.getTitle().compareTo(b2.getTitle()));
        return booksToSort;
    }

    public Book findByIdUsingBinarySearch(int id){
        books.sort((b1, b2) -> Integer.compare(b1.getId(), b2.getId())); // Ensure the list is sorted by ID
        int left = 0;
        int right = books.size() - 1;

        while (left <= right) {
            int mid = left + (right - left) / 2;
            Book midBook = books.get(mid);

            if (midBook.getId() == id) {
                return midBook;
            } else if (midBook.getId() < id) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return null;
    }
}