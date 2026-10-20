package com.example.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.example.library.service.BookWaitlist;

class BookWaitlistTests {
    @Test
    void concurrentDuplicateJoinsKeepExactlyOneEntryPerStudent() throws Exception {
        BookWaitlist waitlist = new BookWaitlist();
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(8)) {
            var tasks = new ArrayList<Future<?>>();
            for (int i = 0; i < 80; i++) {
                int studentId = i % 20 + 1;
                tasks.add(executor.submit(() -> {
                    start.await();
                    waitlist.join(12, studentId);
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> task : tasks) {
                task.get(5, TimeUnit.SECONDS);
            }
        }
        Set<Integer> students = new HashSet<>();
        int entries = 0;
        Integer student;
        while ((student = waitlist.removeNext(12)) != null) {
            students.add(student);
            entries++;
        }
        assertEquals(20, entries);
        assertEquals(20, students.size());
    }

    @Test
    void studentsLeaveInTheOrderTheyJoined() {
        BookWaitlist waitlist = new BookWaitlist();
        waitlist.join(12, 7);
        waitlist.join(12, 3);
        waitlist.join(12, 9);

        assertEquals(Integer.valueOf(7), waitlist.removeNext(12));
        assertEquals(Integer.valueOf(3), waitlist.removeNext(12));
        assertEquals(Integer.valueOf(9), waitlist.removeNext(12));
        assertNull(waitlist.removeNext(12));
    }

    @Test
    void peekingDoesNotRemoveTheStudent() {
        BookWaitlist waitlist = new BookWaitlist();
        waitlist.join(12, 7);

        assertEquals(Integer.valueOf(7), waitlist.peekNext(12));
        assertEquals(Integer.valueOf(7), waitlist.peekNext(12));
        assertEquals(Integer.valueOf(7), waitlist.removeNext(12));
        assertNull(waitlist.peekNext(12));
    }

    @Test
    void duplicateJoinDoesNotAddAnotherPlaceOrChangeOrder() {
        BookWaitlist waitlist = new BookWaitlist();
        waitlist.join(12, 7);
        waitlist.join(12, 3);
        waitlist.join(12, 7);

        assertEquals(Integer.valueOf(7), waitlist.removeNext(12));
        assertEquals(Integer.valueOf(3), waitlist.removeNext(12));
        assertNull(waitlist.removeNext(12));
    }

    @Test
    void eachBookHasAnIndependentQueue() {
        BookWaitlist waitlist = new BookWaitlist();
        waitlist.join(12, 7);
        waitlist.join(27, 7);
        waitlist.join(27, 3);

        assertEquals(Integer.valueOf(7), waitlist.removeNext(12));
        assertNull(waitlist.removeNext(12));
        assertEquals(Integer.valueOf(7), waitlist.removeNext(27));
        assertEquals(Integer.valueOf(3), waitlist.removeNext(27));
    }

    @Test
    void unknownBookHasNoWaitingStudent() {
        BookWaitlist waitlist = new BookWaitlist();

        assertNull(waitlist.peekNext(999));
        assertNull(waitlist.removeNext(999));
    }
}
