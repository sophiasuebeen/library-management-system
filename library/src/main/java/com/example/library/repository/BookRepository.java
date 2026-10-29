package com.example.library.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.example.library.model.Book;

@Transactional(readOnly = true)
public interface BookRepository extends JpaRepository<Book, Integer> {
    @Query("select b from Book b order by b.id")
    List<Book> getAllBooks();

    /* public List<Book> getAllBooks() {
        String sql = """
            SELECT id, title, author, available_copies
            FROM books
            ORDER BY id
            """;

        return jdbc.query(sql, BOOK_MAPPER);
    }
    */

    default Optional<Book> getBookById(int id) {
        return findById(id); //Jpa's built-in findById method
    }
    /*public Optional<Book> getBookById(int id) { //Todo: Search the list by ID
        String sql = """
            SELECT id, title, author, available_copies
            FROM books
            WHERE id = ?
            """;

        return jdbc.query(sql, BOOK_MAPPER, id)
            .stream()
            .findFirst();
    } */

    @Query("select b from Book b where b.title = :title order by b.id")
    List<Book> searchByTitle(@Param("title") String title);

    @Query("select b.availableCopies from Book b where b.id = :id")
    Optional<Integer> findAvailableCopiesById(@Param("id") int bookId);

    @Transactional
    default int addBook(String title, String author, int copies) {
        saveAndFlush(new Book(title, author, copies));
        return 1;
    }
    @Transactional // commit the changes together, or roll them back together if the operation fails.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Book b set b.title = :title, b.author = :author where b.id = :id")
    int updateDetails(@Param("id") int id, @Param("title") String title, @Param("author") String author);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Book b set b.availableCopies = :copies where b.id = :id")
    int updateCopies(@Param("id") int id, @Param("copies") int newCopies);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Book b set b.availableCopies = b.availableCopies - 1 where b.id = :id and b.availableCopies > 0")
    int decrementAvailableCopies(@Param("id") int bookId);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Book b set b.availableCopies = b.availableCopies + 1 where b.id = :id")
    int incrementAvailableCopies(@Param("id") int bookId);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from Book b where b.id = :id")
    int deleteBook(@Param("id") int id);
}
