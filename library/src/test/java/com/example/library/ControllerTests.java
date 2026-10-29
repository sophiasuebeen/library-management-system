package com.example.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

import com.example.library.controller.BookController;
import com.example.library.controller.BorrowingController;
import com.example.library.controller.StudentController;
import com.example.library.repository.BookRepository;
import com.example.library.repository.StudentRepository;
import com.example.library.service.BookService;
import com.example.library.service.BorrowingService;

@SpringBootTest
@ActiveProfiles("test")
@Sql("/reset-schema.sql")
class ControllerTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired BookRepository books;
    @Autowired StudentRepository students;
    @Autowired BorrowingService borrowingService;
    private MockMvc client;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO books (id, title, author, available_copies) VALUES (12, 'Atomic Habits', 'James Clear', 2)");
        jdbc.update("INSERT INTO students (id, name) VALUES (7, 'Sophia')");
        client = MockMvcBuilders.standaloneSetup(
                new BookController(books, new BookService(books)),
                new StudentController(students),
                new BorrowingController(borrowingService)).build();
    }

    @Test
    void listsSearchesAndReadsBooks() throws Exception {
        client.perform(get("/books")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Atomic Habits"))
                .andExpect(jsonPath("$[0].availableCopies").value(2));
        client.perform(get("/books").param("title", "Atomic Habits"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].availableCopies").value(2));
        client.perform(get("/books").param("title", "Missing"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.author").value("James Clear"))
                .andExpect(jsonPath("$.availableCopies").value(2));
        client.perform(get("/books/999")).andExpect(status().isNotFound());
    }

    @Test
    void undoesBookDetailsUpdateAndRejectsEmptyHistory() throws Exception {
        client.perform(post("/books/undo")).andExpect(status().isConflict());
        client.perform(patch("/books/12").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New title\",\"author\":\"New author\"}"))
                .andExpect(status().isNoContent());
        client.perform(get("/books/12"))
                .andExpect(jsonPath("$.title").value("New title"))
                .andExpect(jsonPath("$.author").value("New author"));

        client.perform(post("/books/undo")).andExpect(status().isNoContent());
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Atomic Habits"))
                .andExpect(jsonPath("$.author").value("James Clear"))
                .andExpect(jsonPath("$.availableCopies").value(2));
        client.perform(post("/books/undo")).andExpect(status().isConflict());
    }

    @Test
    void createsEditsAndDeletesBook() throws Exception {
        client.perform(post("/books").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Zero to One\",\"author\":\"Peter Thiel\",\"copies\":3}"))
                .andExpect(status().isCreated());
        assertEquals(3, jdbc.queryForObject("SELECT available_copies FROM books WHERE title = 'Zero to One'", Integer.class));
        client.perform(patch("/books/12").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New title\",\"author\":\"New author\"}"))
                .andExpect(status().isNoContent());
        client.perform(get("/books/12")).andExpect(jsonPath("$.title").value("New title"));
        client.perform(patch("/books/12/copies").contentType(MediaType.APPLICATION_JSON)
                .content("{\"copies\":5}")).andExpect(status().isNoContent());
        assertEquals(5, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class));
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableCopies").value(5));
        client.perform(delete("/books/12")).andExpect(status().isNoContent());
        client.perform(get("/books/12")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidBookInputWithoutWritingData() throws Exception {
        client.perform(post("/books").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"\",\"author\":\"A\",\"copies\":1}"))
                .andExpect(status().isBadRequest());
        client.perform(post("/books").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"B\",\"author\":\"A\"}"))
                .andExpect(status().isBadRequest());
        client.perform(patch("/books/12/copies").contentType(MediaType.APPLICATION_JSON)
                .content("{\"copies\":-1}")).andExpect(status().isBadRequest());
        client.perform(get("/books/0")).andExpect(status().isBadRequest());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM books", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class));
    }

    @Test
    void returnsNotFoundForMissingUpdateAndDeleteTargets() throws Exception {
        client.perform(patch("/books/999/copies").contentType(MediaType.APPLICATION_JSON)
                .content("{\"copies\":1}")).andExpect(status().isNotFound());
        client.perform(patch("/books/999").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"B\",\"author\":\"A\"}")).andExpect(status().isNotFound());
        client.perform(delete("/books/999")).andExpect(status().isNotFound());
        client.perform(patch("/students/999").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Alex\"}")).andExpect(status().isNotFound());
        client.perform(delete("/students/999")).andExpect(status().isNotFound());
    }

    @Test
    void createsReadsUpdatesAndDeletesStudent() throws Exception {
        client.perform(post("/students").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" Alex \"}")).andExpect(status().isCreated());
        client.perform(get("/students")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        client.perform(get("/students/7")).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sophia"));
        client.perform(patch("/students/7").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Sophie\"}")).andExpect(status().isNoContent());
        client.perform(get("/students/7")).andExpect(jsonPath("$.name").value("Sophie"));
        client.perform(delete("/students/7")).andExpect(status().isNoContent());
        client.perform(get("/students/7")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsInvalidStudentNamesAndIds() throws Exception {
        client.perform(post("/students").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" \"}")).andExpect(status().isBadRequest());
        client.perform(patch("/students/7").contentType(MediaType.APPLICATION_JSON)
                .content("{}")).andExpect(status().isBadRequest());
        client.perform(get("/students/-1")).andExpect(status().isBadRequest());
        assertEquals("Sophia", jdbc.queryForObject("SELECT name FROM students WHERE id = 7", String.class));
    }

    @Test
    void returnsABookAndRepeatedRequestsDoNotAddCopiesTwice() throws Exception {
        client.perform(post("/borrowings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":7,\"bookId\":12}"))
                .andExpect(status().isCreated());
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableCopies").value(1));
        int borrowingId = jdbc.queryForObject("SELECT id FROM borrowings", Integer.class);
        client.perform(get("/borrowings")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].borrowingId").value(borrowingId));

        client.perform(patch("/borrowings/" + borrowingId + "/return"))
                .andExpect(status().isNoContent());
        client.perform(get("/borrowings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.availableCopies").value(2));
        client.perform(patch("/borrowings/" + borrowingId + "/return"))
                .andExpect(status().isNoContent());

        assertEquals(2, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM borrowings", Integer.class));
    }

    @Test
    void returnRejectsInvalidAndMissingBorrowingIds() throws Exception {
        client.perform(patch("/borrowings/0/return")).andExpect(status().isBadRequest());
        client.perform(patch("/borrowings/-1/return")).andExpect(status().isBadRequest());
        client.perform(patch("/borrowings/abc/return")).andExpect(status().isBadRequest());
        client.perform(patch("/borrowings/999/return")).andExpect(status().isNotFound());
        assertEquals(2, jdbc.queryForObject("SELECT available_copies FROM books WHERE id = 12", Integer.class));
    }

    @Test
    void showsOnlyCurrentBorrowingsAndProtectsHistoryFromDeletion() throws Exception {
        client.perform(post("/borrowings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"studentId\":7,\"bookId\":12}"))
                .andExpect(status().isCreated());
        client.perform(get("/borrowings")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].studentName").value("Sophia"))
                .andExpect(jsonPath("$[0].bookTitle").value("Atomic Habits"));
        jdbc.update("UPDATE borrowings SET returned_date = CURDATE()");
        client.perform(get("/borrowings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        client.perform(delete("/books/12")).andExpect(status().isConflict());
        client.perform(delete("/students/7")).andExpect(status().isConflict());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM borrowings", Integer.class));
    }
}
