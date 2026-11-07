DROP TABLE IF EXISTS book_covers;
DROP TABLE IF EXISTS borrowings;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS students;
CREATE TABLE books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    available_copies INT NOT NULL
);
CREATE TABLE book_covers (
    book_id INT PRIMARY KEY,
    content_type VARCHAR(32) NOT NULL,
    image MEDIUMBLOB NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT fk_book_covers_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
CREATE TABLE borrowings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id),
    book_id INT NOT NULL REFERENCES books(id),
    borrowed_date DATE NOT NULL,
    returned_date DATE
);
