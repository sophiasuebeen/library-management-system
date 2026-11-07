package com.example.library.controller;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.library.repository.BookCoverRepository;
import com.example.library.repository.BookCoverRepository.CoverVersion;
import com.example.library.repository.BookCoverRepository.StoredCover;
import com.example.library.repository.BookRepository;

@RestController
public class BookCoverController {
    static final int MAX_COVER_BYTES = 2 * 1024 * 1024;

    private final BookCoverRepository covers;
    private final BookRepository books;

    public BookCoverController(BookCoverRepository covers, BookRepository books) {
        this.covers = covers;
        this.books = books;
    }

    @GetMapping("/books/covers")
    public List<CoverVersion> listCovers() {
        return covers.listVersions();
    }

    @GetMapping("/books/{id}/cover")
    public ResponseEntity<byte[]> getCover(@PathVariable("id") int id,
            @RequestParam(name = "v", required = false) Long version) {
        requirePositiveId(id);
        StoredCover cover = covers.find(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cover not found."));
        // A versioned URL never changes content, because each upload gets a new version.
        CacheControl cache = version != null && version == cover.version()
                ? CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable()
                : CacheControl.noCache();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(cover.contentType()))
                .cacheControl(cache)
                .header("X-Content-Type-Options", "nosniff")
                .body(cover.image());
    }

    @PutMapping("/books/{id}/cover")
    public ResponseEntity<Void> putCover(@PathVariable("id") int id, InputStream body) throws IOException {
        requirePositiveId(id);
        // Stop reading past the limit so an oversized upload cannot exhaust server memory.
        byte[] image = body.readNBytes(MAX_COVER_BYTES + 1);
        if (image.length > MAX_COVER_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Covers must be at most 2 MB.");
        }
        String contentType = detectImageType(image);
        if (contentType == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Covers must be JPEG, PNG or WebP images.");
        }
        if (!books.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Book not found.");
        }
        covers.save(id, contentType, image, System.currentTimeMillis());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/books/{id}/cover")
    public ResponseEntity<Void> deleteCover(@PathVariable("id") int id) {
        requirePositiveId(id);
        if (covers.delete(id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cover not found.");
        }
        return ResponseEntity.noContent().build();
    }

    /** Trusts the file's own signature, not the Content-Type the caller claims. */
    private static String detectImageType(byte[] image) {
        if (startsWith(image, 0, 0xFF, 0xD8, 0xFF)) {
            return MediaType.IMAGE_JPEG_VALUE;
        }
        if (startsWith(image, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (startsWith(image, 0, 'R', 'I', 'F', 'F') && startsWith(image, 8, 'W', 'E', 'B', 'P')) {
            return "image/webp";
        }
        return null;
    }

    private static boolean startsWith(byte[] image, int offset, int... signature) {
        if (image.length < offset + signature.length) {
            return false;
        }
        byte[] expected = new byte[signature.length];
        for (int i = 0; i < signature.length; i++) {
            expected[i] = (byte) signature[i];
        }
        return Arrays.equals(image, offset, offset + signature.length, expected, 0, signature.length);
    }

    private static void requirePositiveId(int id) {
        if (id <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Book ID must be positive.");
        }
    }
}
