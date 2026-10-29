# How JPA works in this library

The application's books, students, and borrowing history now use Spring Data JPA
with Hibernate. Controllers keep the same URLs, request bodies, status codes,
and response fields. The waitlist and undo history still live in memory; converting
the database access layer does not make those collections persistent.

## 1. Dependency and configuration

`library/pom.xml` includes `spring-boot-starter-data-jpa`. Spring Boot's parent
manages compatible versions of Spring Data JPA and Hibernate. The MySQL driver
stays a runtime dependency. JPA still uses JDBC underneath, but application
repositories no longer use `JdbcTemplate` or row mappers.

Normal startup uses:

```properties
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
```

`validate` checks that tables and mapped columns exist with compatible types; it
does not create tables, migrate data, or comprehensively verify foreign keys and
other database constraints. Do not use `create` or `create-drop` against a database
you want to keep. Database schema changes need deliberate SQL migrations.

The existing MySQL schema needs:

- `books`: auto-increment INT `id`, `title`, `author`, INT `available_copies`.
- `students`: auto-increment INT `id`, `name`.
- `borrowings`: auto-increment INT `id`, INT `student_id`, INT `book_id`, DATE
  `borrowed_date`, nullable DATE `returned_date`.
- Foreign keys from borrowings to students/books, using InnoDB and preventing
  deletion of referenced parents.

Inspect an existing database with `SHOW CREATE TABLE books;`, and likewise for
`students` and `borrowings`. For a completely empty database, `mysql-schema.sql`
in this folder provides the schema. It is documentation and is not run by Spring.
Do not run it against existing tables; review a migration if their structure differs.

## 2. Entities map Java fields to columns

`Book`, `Student`, and `Borrowing` have:

- `@Entity`: Hibernate manages instances of this class.
- `@Table`: names the existing table.
- `@Id`: identifies the primary key.
- `@GeneratedValue(IDENTITY)`: lets the database assign new IDs.
- A protected no-argument constructor: Hibernate needs it when loading rows.
- `@Column`: names columns where Java and SQL naming differ, and describes nullability.

New entities use constructors without an ID:

```java
Book book = new Book("Java Persistence", "Example Author", 3);
Book saved = books.saveAndFlush(book);
int generatedId = saved.getId();
```

The older constructors accepting IDs remain available for the search exercises
and existing tests. Do not assign IDs to new database records.

## 3. Relationships use objects

`Borrowing` has two `@ManyToOne` relationships:

```text
many Borrowing records -> one Student
many Borrowing records -> one Book
```

`@JoinColumn(name = "student_id")` stores the student's ID while Java code works
with a `Student` object. `book_id` works the same way. Both relationships are lazy,
so related data is loaded when accessed inside a transaction. There is no remove
cascade: deleting a borrowing must never delete its student or book.

Hibernate generates `borrowed_date` using the database's current date on insert.
Returns also use the database's current date, preserving the previous JDBC behavior.

## 4. Repository interfaces replace handwritten JDBC classes

`BookRepository`, `StudentRepository`, and `BorrowingRepository` extend
`JpaRepository<Entity, Integer>`. Spring creates their implementations at startup.
Your controllers receive these implementations through constructor injection.

Inherited operations include `findById`, `save`, `saveAndFlush`, and `getReferenceById`.
The repository methods already used by controllers remain available, avoiding a
separate API migration. Small default methods adapt existing create operations
and return the same affected-row count as before.

`repoPractice` is your existing learning interface. It remains available for
experiments with derived methods such as `findByAuthor`; production controllers
use `BookRepository`.

Custom `@Query` statements use JPQL: entity names and Java property names rather
than SQL table/column names. For example:

```java
@Query("select b from Book b where b.title = :title order by b.id")
List<Book> searchByTitle(@Param("title") String title);
```

Hibernate translates it into SQL for the configured database. Ordinary managed
entity edits inside a transaction can use dirty checking: modify a field and
Hibernate writes the change when the persistence context flushes.

## 5. Borrowing stays one transaction

`BorrowingService.borrow` performs these operations inside `@Transactional`:

1. Validate positive IDs.
2. Atomically decrease stock only if copies remain.
3. Obtain JPA references to the existing student and book.
4. Save and flush a new `Borrowing`.
5. Commit both writes, or roll back both on failure.

`getReferenceById` does not prove an ID exists. Database foreign keys enforce the
relationship; an invalid student causes persistence to fail and the transaction
to restore the stock decrease.

Stock changes deliberately use `@Modifying` JPQL updates. Reading a count,
subtracting in Java, and saving could let two borrowers claim the last copy.
The conditional database update returns 1 for success and 0 when unavailable.

A return first conditionally sets `returnedDate` only when it is null, then
increments stock only when that update succeeded. Repeated or simultaneous
returns cannot increment it twice. Both writes share a transaction.

Bulk updates bypass managed entity state. `flushAutomatically` writes pending
changes first; `clearAutomatically` detaches cached entities afterwards. Re-fetch
an entity after a bulk update to see its latest values.

## 6. Read responses without lazy-loading surprises

Borrowing listings use a JPQL constructor projection into `BorrowingView`, joining
students and books in one query. The API does not serialize the `Borrowing` entity
or traverse its lazy relationships. This also avoids one extra query per related
student/book. Book and Student responses keep their existing scalar fields.

## 7. Run and verify

From the repository root:

```bash
cd library
./mvnw test
```

Use Java 25 or newer. This machine's default shell Java is 21; its installed
Homebrew Java 27 can run the build with:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home ./mvnw test
```

Tests explicitly activate the `test` profile, which uses an isolated H2 in-memory
database. Tests cover CRUD, DTO responses, rollback, stock concurrency, repeated
returns, generated IDs, relationship persistence, database dates, dirty checking,
and clearing stale entity state. JDBC is used in tests to seed/check rows independently
of the application repositories. Passing H2 tests does not establish MySQL-specific
locking behavior or compatibility with your actual local schema.

For normal startup, start MySQL, set `DB_PASSWORD`, then run `./mvnw spring-boot:run`
with the same Java selection if needed. Never enable the test profile for normal use:
its in-memory contents disappear when the process exits.

To inspect generated SQL during local learning, temporarily enable:

```properties
logging.level.org.hibernate.SQL=DEBUG
```

## Further reading

- [Spring's introductory JPA exercise](https://spring.io/guides/gs/accessing-data-jpa/)
- [Spring Data JPA query methods and modifying queries](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)
- [Hibernate ORM documentation](https://hibernate.org/orm/documentation/)
