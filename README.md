# My Library
command-k v to preview markdown
## JPA / ORM

Books, students, and borrowing history use Spring Data JPA with Hibernate.
See [the implementation guide](docs/JPA.md) for entity mappings, repository methods,
transactions, schema requirements, and how to run the tests.

## How to run

1. Save all files and start the MySQL server.
   The `library` database must already have the `books`, `students`, and `borrowings` tables.

2. Open a terminal in `MyLibDBMS` and go into the app folder:

   ```bash
   cd library
   ```

3. Enter the MySQL root password (it stays hidden while typing):

   ```zsh
   read -s "DB_PASSWORD?MySQL password: "
   export DB_PASSWORD
   ```

4. Check that the code and tests work:

   ```bash
   ./mvnw clean test
   ```

   Wait for `BUILD SUCCESS`.

5. Start the app in the same terminal:

   ```bash
   ./mvnw spring-boot:run
   ```

   Wait for `Started LibraryApplication`. Leave the terminal running.

6. Open the app in a browser:

   ```text
   http://localhost:8080/
   ```

   To check the APIs:

   ```text
   http://localhost:8080/books
   http://localhost:8080/students
   http://localhost:8080/borrowings
   ```

7. Stop the app in the terminal:

   ```text
   Ctrl+C
   ```

Only start the Spring Boot app. No need to run each Java file or the old root-level `Main.java`.

Requires Java 25. Check the installed version with:

```bash
java -version
```

## Frontend

Open `http://localhost:8080/` after starting the app. No separate frontend server is needed.

- **Books:** view available copies, search, add, edit, delete, set available copies, borrow, or open a book's waitlist.
- **Students:** register, edit, or delete students.
- **Borrowings:** view current borrowings, borrow a book, or confirm a return using its borrowing ID.
- **Waitlists:** choose a book, join a student, view the next student, or confirm removal of the next entry.

Register a student and add a book with available copies before borrowing.
Waitlist joining requires zero available copies; a student already waiting keeps their place.
Removing the next entry only changes the queue. It does not lend a book.
Returning a book restores a copy but does not automatically assign it to the waitlist.
Book list, search, and detail API responses include `availableCopies` from the database.

The frontend files are in `library/src/main/resources/static/`:

```text
index.html  — page structure and forms
styles.css  — colors and layout
app.js      — button actions and API requests
```

## Waitlist APIs

Use existing book/student IDs. Joining is allowed only when the book has zero available copies.

```bash
# Join (204 on success; joining twice does not add a duplicate)
curl -i -X POST http://localhost:8080/books/12/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"studentId":7}'

# View the next student without removing them (200 with JSON, or 204 if empty)
curl -i http://localhost:8080/books/12/waitlist/next

# Remove the next student (204, including when the queue is empty)
curl -i -X POST http://localhost:8080/books/12/waitlist/next/remove
```

Invalid IDs return 400; missing books/students return 404; joining while copies are available returns 409.
Removing the next student only changes the queue; it does not create a borrowing or return a book.
Do not automatically retry removal: another call can remove another student.
Waitlists are stored in memory and disappear when the app restarts. They are local to one app instance.
Queue methods are synchronized, but the database availability check and queue update are separate steps.

## Return a borrowed book

First find the `borrowingId` in the current borrowings:

```bash
curl -i http://localhost:8080/borrowings
```

Use that borrowing ID below (not the book ID):

```bash
curl -i -X PATCH http://localhost:8080/borrowings/1/return
```

No JSON body is needed. Success returns 204, including if it was already returned.
The app marks the borrowing returned and restores one available copy in one transaction.
Repeating the request does not restore extra copies. Invalid IDs return 400; missing borrowings return 404.
Returning does not automatically assign a copy to the waitlist yet.

## Postman skills status

From the `MyLibDBMS` folder:

```bash
postman skills status
```

For Postman CLI 1.75.0, the installed skills are stored in `.postman/agent-skills/`.
`postman/skills` is a symbolic link (a filesystem shortcut) to that folder, so existing skill paths still work.
This works around the CLI incorrectly classifying its own Python skill helpers as application source files.
