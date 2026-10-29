-- Reference schema for a NEW, EMPTY MySQL database only.
-- Select/create your intended database before executing. Not run automatically.
CREATE TABLE books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    available_copies INT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE borrowings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    book_id INT NOT NULL,
    borrowed_date DATE NOT NULL,
    returned_date DATE,
    CONSTRAINT fk_borrowings_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_borrowings_book FOREIGN KEY (book_id) REFERENCES books(id)
) ENGINE=InnoDB;
