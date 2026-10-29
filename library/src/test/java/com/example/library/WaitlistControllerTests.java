package com.example.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.example.library.controller.WaitlistController;
import com.example.library.repository.BookRepository;
import com.example.library.repository.StudentRepository;
import com.example.library.service.BookWaitlist;

@SpringBootTest
@ActiveProfiles("test")
@Sql("/reset-schema.sql")
class WaitlistControllerTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BookRepository books;
    @Autowired StudentRepository students;
    private MockMvc client;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO books VALUES (12, 'Book A', 'Author', 0), (27, 'Book B', 'Author', 0), (30, 'Available', 'Author', 2)");
        jdbc.update("INSERT INTO students VALUES (7, 'Sophia'), (8, 'Alex')");
        client = MockMvcBuilders.standaloneSetup(new WaitlistController(
                new BookWaitlist(), books, students)).build();
    }

    private void join(int bookId, int studentId) throws Exception {
        client.perform(post("/books/" + bookId + "/waitlist")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":" + studentId + "}"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
    }

    @Test
    void joinsPeeksAndRemovesInFifoOrderWithoutDuplicates() throws Exception {
        join(12, 7);
        join(12, 8);
        join(12, 7);
        for (int i = 0; i < 2; i++) {
            client.perform(get("/books/12/waitlist/next"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.studentId").value(7));
        }
        client.perform(post("/books/12/waitlist/next/remove")).andExpect(status().isNoContent());
        client.perform(get("/books/12/waitlist/next"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.studentId").value(8));
        client.perform(post("/books/12/waitlist/next/remove")).andExpect(status().isNoContent());
        client.perform(get("/books/12/waitlist/next"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertEquals(0, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class));
    }

    @Test
    void eachBookHasItsOwnWaitlist() throws Exception {
        join(12, 7);
        join(27, 8);
        client.perform(post("/books/12/waitlist/next/remove")).andExpect(status().isNoContent());
        client.perform(get("/books/27/waitlist/next"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.studentId").value(8));
    }

    @Test
    void emptyQueueHasNoContentAndCanBeRemovedFromSafely() throws Exception {
        client.perform(get("/books/12/waitlist/next"))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        client.perform(post("/books/12/waitlist/next/remove")).andExpect(status().isNoContent());
    }

    @Test
    void rejectsInvalidBookIdsForAllOperations() throws Exception {
        for (int id : new int[] {0, -1}) {
            client.perform(post("/books/" + id + "/waitlist")
                    .contentType(MediaType.APPLICATION_JSON).content("{\"studentId\":7}"))
                    .andExpect(status().isBadRequest());
            client.perform(get("/books/" + id + "/waitlist/next")).andExpect(status().isBadRequest());
            client.perform(post("/books/" + id + "/waitlist/next/remove")).andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejectsMissingMalformedAndInvalidStudentInput() throws Exception {
        for (String body : new String[] {"", "null", "{}", "{", "{\"studentId\":0}",
                "{\"studentId\":-1}", "{\"studentId\":null}", "{\"studentId\":\"abc\"}"}) {
            client.perform(post("/books/12/waitlist")
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        client.perform(get("/books/12/waitlist/next")).andExpect(status().isNoContent());
    }

    @Test
    void rejectsMissingBooksForAllOperations() throws Exception {
        client.perform(post("/books/999/waitlist")
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentId\":7}"))
                .andExpect(status().isNotFound());
        client.perform(get("/books/999/waitlist/next")).andExpect(status().isNotFound());
        client.perform(post("/books/999/waitlist/next/remove")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsMissingStudentsWithoutJoining() throws Exception {
        client.perform(post("/books/12/waitlist")
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentId\":999}"))
                .andExpect(status().isNotFound());
        client.perform(get("/books/12/waitlist/next")).andExpect(status().isNoContent());
    }

    @Test
    void rejectsJoiningWhenCopiesAreAvailable() throws Exception {
        client.perform(post("/books/30/waitlist")
                .contentType(MediaType.APPLICATION_JSON).content("{\"studentId\":7}"))
                .andExpect(status().isConflict());
        client.perform(get("/books/30/waitlist/next")).andExpect(status().isNoContent());
        assertEquals(2, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 30", Integer.class));
    }
}
