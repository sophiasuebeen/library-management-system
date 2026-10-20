package com.example.library.model; //

public class Book{
    private int id;
    private String title;
    private String author;
    private int availableCopies;

    public Book(int id, String title, String author){
        this(id, title, author, 0);
    }

    public Book(int id, String title, String author, int availableCopies){
        this.id = id;
        this.title = title;
        this.author = author;
        this.availableCopies = availableCopies;
    }

    public int getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAuthor() {
        return author;
    }

    public int getAvailableCopies() {
        return availableCopies;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setAuthor(String author) {
        this.author = author;
    }
}
