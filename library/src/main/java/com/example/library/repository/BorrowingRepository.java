package com.example.library.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import com.example.library.dto.BorrowingView;
import com.example.library.model.Borrowing;

@Transactional(readOnly = true)
public interface BorrowingRepository extends JpaRepository<Borrowing, Integer> {
    // Project directly into the API DTO. No lazy entities escape to JSON and
    // this single joined query avoids fetching each book/student separately.
    @Query("""
        select new com.example.library.dto.BorrowingView(
            b.id, s.name, book.title, b.borrowedDate)
        from Borrowing b join b.student s join b.book book
        where b.returnedDate is null
        order by b.id
        """)
    List<BorrowingView> getAllBorrowings();

    @Query("select b.book.id from Borrowing b where b.id = :id")
    Optional<Integer> findBookIdByBorrowingId(@Param("id") int borrowingId);

    @Transactional
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Borrowing b set b.returnedDate = CURRENT_DATE where b.id = :id and b.returnedDate is null")
    int markReturnedIfActive(@Param("id") int borrowingId);
}
