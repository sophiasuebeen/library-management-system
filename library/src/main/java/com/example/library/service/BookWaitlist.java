package com.example.library.service;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.Map;
import java.util.Queue;

import org.springframework.stereotype.Service;


@Service
public class BookWaitlist {
    private final Map<Integer, Queue<Integer>> waitlists = new HashMap<>();
    // separate waiting line for each book (key, val) = (Book ID, Queue of student IDs)
    // e.g. 10 -> [101,102, 103]


    // Add a student to the end of a book's waitlist
    // Spring shares this service between requests. Synchronize map/queue access.
    public synchronized void join(int bookId, int studentId) {
        Queue<Integer> queue = waitlists.computeIfAbsent(
            bookId,
            id -> new LinkedList<>()
        );
        //computeIfAbsent() : 
        // if this book has no map entry, create a new LinkedList (Queue)
        // else get this book's existing Queue

        if (!queue.contains(studentId)) {
            queue.offer(studentId);
        } //if this queue does not have this student add this student to the queue
    }
    // check the next student without removing them
    public synchronized Integer peekNext(int bookId) {
        Queue<Integer> queue = waitlists.get(bookId); //get this book's queue
        return queue == null ? null : queue.peek(); //if null then return null else return who's next
    }

    //remove and return the next student
    public synchronized Integer removeNext(int bookId) {
        Queue<Integer> queue = waitlists.get(bookId);
        return queue == null ? null : queue.poll();
    }
}
