package com.example.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.example.library.controller.BookController;
import com.example.library.controller.BookCoverController;
import com.example.library.repository.BookCoverRepository;
import com.example.library.repository.BookRepository;
import com.example.library.service.BookService;

@SpringBootTest
@ActiveProfiles("test")
@Sql("/reset-schema.sql")
class BookCoverControllerTests {
    private static final String PASSWORD = "test-password";
    private static final byte[] JPEG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3 };
    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 4 };
    private static final byte[] WEBP = { 'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P' };

    @Autowired JdbcTemplate jdbc;
    @Autowired BookRepository books;
    @Autowired BookCoverRepository covers;
    private MockMvc client;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO books (id, title, author, available_copies) VALUES (12, 'Atomic Habits', 'James Clear', 2)");
        client = clientWithPassword(PASSWORD);
    }

    private MockMvc clientWithPassword(String password) {
        return MockMvcBuilders.standaloneSetup(
                new BookCoverController(covers, books, password),
                new BookController(books, new BookService(books))).build();
    }

    private static MockHttpServletRequestBuilder upload(int id, byte[] image) {
        return put("/books/{id}/cover", id).header("X-Admin-Password", PASSWORD).content(image);
    }

    @Test
    void storesReplacesServesAndRemovesACover() throws Exception {
        client.perform(get("/books/12/cover")).andExpect(status().isNotFound());
        client.perform(get("/books/covers")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        client.perform(upload(12, JPEG)).andExpect(status().isNoContent());
        client.perform(get("/books/12/cover")).andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(content().bytes(JPEG))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "no-cache"));
        client.perform(get("/books/covers"))
                .andExpect(jsonPath("$[0].bookId").value(12))
                .andExpect(jsonPath("$[0].version").isNumber());

        // Replacing keeps one row per book and reports the new image type.
        client.perform(upload(12, PNG)).andExpect(status().isNoContent());
        client.perform(get("/books/12/cover")).andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG));
        client.perform(get("/books/covers")).andExpect(jsonPath("$.length()").value(1));

        client.perform(delete("/books/12/cover").header("X-Admin-Password", PASSWORD))
                .andExpect(status().isNoContent());
        client.perform(get("/books/12/cover")).andExpect(status().isNotFound());
        client.perform(delete("/books/12/cover").header("X-Admin-Password", PASSWORD))
                .andExpect(status().isNotFound());
    }

    @Test
    void cachesOnlyTheCurrentVersionForever() throws Exception {
        client.perform(upload(12, JPEG)).andExpect(status().isNoContent());
        long version = jdbc.queryForObject("SELECT version FROM book_covers WHERE book_id = 12", Long.class);

        client.perform(get("/books/12/cover").param("v", String.valueOf(version)))
                .andExpect(header().string("Cache-Control", "max-age=31536000, public, immutable"));
        client.perform(get("/books/12/cover").param("v", String.valueOf(version - 1)))
                .andExpect(header().string("Cache-Control", "no-cache"));
    }

    @Test
    void rejectsMissingOrWrongPasswordWithoutChangingCovers() throws Exception {
        client.perform(upload(12, JPEG)).andExpect(status().isNoContent());

        client.perform(put("/books/12/cover").content(PNG)).andExpect(status().isUnauthorized());
        client.perform(put("/books/12/cover").header("X-Admin-Password", "wrong").content(PNG))
                .andExpect(status().isUnauthorized());
        client.perform(delete("/books/12/cover")).andExpect(status().isUnauthorized());
        client.perform(delete("/books/12/cover").header("X-Admin-Password", "wrong"))
                .andExpect(status().isUnauthorized());

        client.perform(get("/books/12/cover")).andExpect(content().bytes(JPEG));
    }

    @Test
    void refusesEveryWriteWhenNoPasswordIsConfigured() throws Exception {
        MockMvc unconfigured = clientWithPassword("");
        unconfigured.perform(put("/books/12/cover").header("X-Admin-Password", "").content(JPEG))
                .andExpect(status().isForbidden());
        unconfigured.perform(delete("/books/12/cover").header("X-Admin-Password", ""))
                .andExpect(status().isForbidden());
        client.perform(get("/books/12/cover")).andExpect(status().isNotFound());
    }

    @Test
    void acceptsOnlyRealImagesWithinTheSizeLimit() throws Exception {
        client.perform(upload(12, WEBP)).andExpect(status().isNoContent());
        client.perform(get("/books/12/cover")).andExpect(content().contentType("image/webp"));

        // The claimed type is ignored: a script labelled as a JPEG is still refused.
        client.perform(upload(12, "<svg onload=alert(1)>".getBytes()).contentType("image/jpeg"))
                .andExpect(status().isUnsupportedMediaType());
        client.perform(upload(12, new byte[0])).andExpect(status().isUnsupportedMediaType());

        byte[] limit = Arrays.copyOf(JPEG, 2 * 1024 * 1024);
        client.perform(upload(12, limit)).andExpect(status().isNoContent());
        byte[] tooLarge = Arrays.copyOf(JPEG, 2 * 1024 * 1024 + 1);
        client.perform(upload(12, tooLarge)).andExpect(status().isPayloadTooLarge());
    }

    @Test
    void reportsMissingBooksAndInvalidIds() throws Exception {
        client.perform(upload(999, JPEG)).andExpect(status().isNotFound());
        client.perform(upload(0, JPEG)).andExpect(status().isBadRequest());
        client.perform(get("/books/0/cover")).andExpect(status().isBadRequest());
    }

    @Test
    void deletingABookDeletesItsCover() throws Exception {
        client.perform(upload(12, JPEG)).andExpect(status().isNoContent());
        client.perform(delete("/books/12")).andExpect(status().isNoContent());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM book_covers", Integer.class));
    }

    @Test
    void coverRoutesDoNotChangeExistingBookRoutes() throws Exception {
        client.perform(get("/books/12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Atomic Habits"));
        client.perform(get("/books")).andExpect(jsonPath("$[0].id").value(12));
    }
}
