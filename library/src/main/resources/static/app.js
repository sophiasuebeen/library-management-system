// Each screen uses the existing Spring controller endpoints. No frontend framework needed.
const $ = (id) => document.getElementById(id);
const screens = {
    books: { title: 'Books', description: 'Find a title or make room for a new story.', heading: 'Book collection', add: '+ Add book', columns: ['ID', 'Title', 'Author', 'Available copies', 'Actions'] },
    students: { title: 'Students', description: 'Keep your readers in one place.', heading: 'Registered students', add: '+ Register student', columns: ['ID', 'Name', 'Actions'] },
    borrowings: { title: 'Borrowings', description: 'See which stories are out in the world.', heading: 'Current borrowings', add: '+ Borrow a book', columns: ['Borrowing ID', 'Student', 'Book', 'Borrowed date', 'Actions'] },
    waitlists: { title: 'Waitlists', description: 'Give every reader a turn.', heading: 'Book waitlists', add: '+ Join waitlist', columns: [] }
};
let section = 'books';
let loadVersion = 0;
let submitAction;
let saving = false;
let preparingBorrow = false;
let preparingJoin = false;
let undoing = false;
let waitlistBookId = '';
let waitlistBook = null;
let nextStudentId = null;

// GET returns JSON. Mutations may return an empty body (201 or 204).
async function request(path, method = 'GET', data) {
    let response;
    try {
        response = await fetch(path, {
            method,
            headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
            body: data === undefined ? undefined : JSON.stringify(data)
        });
    } catch {
        const error = new Error(path === '/books/undo'
            ? 'The connection was lost. Undo may have completed. Refresh and check the books before undoing again.'
            : path.endsWith('/next/remove')
            ? 'The connection was lost. Removal may have completed. Refresh the queue and check who is next before removing again.'
            : 'Cannot reach the library. Check that the app is running, then try again.');
        error.uncertainRemoval = path.endsWith('/next/remove');
        throw error;
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const fallback = response.status === 409
            ? path === '/books/undo'
                ? 'There is no book edit to undo, or the edited book can no longer be restored.'
                : path.endsWith('/waitlist')
                ? 'This book has available copies. Students can join its waitlist only when no copies are available.'
                : 'This action conflicts with the current records. A book may have no copies left, or a record may have borrowing history.'
            : response.status === 404 ? 'This record no longer exists. Refresh the list.'
            : response.status >= 500 ? 'The library could not complete the request. Check the server and database, then try again.'
            : 'Check your entries and try again.';
        throw new Error(error.detail || error.message || `${fallback} (HTTP ${response.status})`);
    }
    return response.status === 204 || method !== 'GET' ? null : response.json();
}

function notify(message, error = false) {
    $('notice').textContent = message;
    $('notice').classList.toggle('error', error);
    $('notice').hidden = false;
}

function cell(row, value) {
    const td = document.createElement('td');
    td.textContent = value;
    row.append(td);
    return td;
}

function action(container, label, callback, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `secondary${danger ? ' danger' : ''}`;
    button.textContent = label;
    button.addEventListener('click', callback);
    container.append(button);
}

async function loadList() {
    const version = ++loadVersion;
    const current = section;
    $('list-status').textContent = `Loading ${current}…`;
    $('list-status').hidden = false;
    $('data-table').hidden = true;
    $('table-body').replaceChildren();
    if (current === 'waitlists') {
        await loadWaitlist(version);
        return;
    }
    const query = current === 'books' ? $('search').value.trim() : '';
    try {
        const rows = await request(`/${current}${query ? `?title=${encodeURIComponent(query)}` : ''}`);
        // Ignore older responses when someone switches screens or searches again.
        if (version !== loadVersion) return;
        $('list-status').textContent = rows.length ? `${rows.length} ${current === 'borrowings' ? 'borrowing' : current === 'students' ? 'student' : 'book'}${rows.length === 1 ? '' : 's'}`
            : query ? 'No books match your search.' : `No ${current} yet.`;
        for (const item of rows) {
            const row = document.createElement('tr');
            if (current === 'borrowings') {
                cell(row, Number.isInteger(item.borrowingId) ? `#${item.borrowingId}` : 'Unavailable');
                cell(row, item.studentName);
                cell(row, item.bookTitle);
                cell(row, item.borrowedDate);
                const actions = document.createElement('div');
                actions.className = 'row-actions';
                action(actions, 'Return book', () => returnBook(item));
                const td = document.createElement('td');
                td.append(actions);
                row.append(td);
            } else {
                cell(row, `#${item.id}`);
                cell(row, current === 'books' ? item.title : item.name);
                if (current === 'books') {
                    cell(row, item.author);
                    cell(row, item.availableCopies ?? 'Unavailable');
                }
                const actions = document.createElement('div');
                actions.className = 'row-actions';
                action(actions, 'Edit', () => current === 'books' ? editBook(item) : editStudent(item));
                if (current === 'books') {
                    action(actions, 'Set copies', () => editCopies(item));
                    action(actions, 'Borrow', () => borrowBook(item.id));
                    action(actions, 'Waitlist', () => viewWaitlist(item.id));
                }
                action(actions, 'Delete', () => deleteRecord(current, item), true);
                const td = document.createElement('td');
                td.append(actions);
                row.append(td);
            }
            $('table-body').append(row);
        }
        $('data-table').hidden = rows.length === 0;
    } catch (error) {
        if (version === loadVersion) $('list-status').textContent = `${error.message} Use Refresh to retry.`;
    }
}

function showSection(name) {
    section = name;
    const screen = screens[name];
    document.querySelectorAll('[data-section]').forEach((button) => {
        if (button.dataset.section === name) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    $('page-title').textContent = screen.title;
    $('description').textContent = screen.description;
    $('list-heading').textContent = screen.heading;
    $('table-caption').textContent = screen.title;
    $('add-button').textContent = screen.add;
    $('search-form').hidden = name !== 'books';
    $('undo-book-edit').hidden = name !== 'books';
    $('undo-help').hidden = name !== 'books';
    $('waitlist-panel').hidden = name !== 'waitlists';
    $('add-button').disabled = name === 'waitlists';
    $('remove-next').disabled = true;
    $('notice').hidden = true;
    const row = document.createElement('tr');
    for (const label of screen.columns) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = label;
        row.append(th);
    }
    $('table-head').replaceChildren(row);
    loadList();
}

// Build labels and inputs using DOM methods so book titles and names remain plain text.
function field(name, label, value = '', type = 'text', options = null) {
    const wrapper = document.createElement('label');
    wrapper.className = 'field';
    wrapper.textContent = label;
    const input = document.createElement(options ? 'select' : 'input');
    input.name = name;
    input.required = true;
    if (options) {
        const placeholder = new Option(`Choose ${label.toLowerCase()}…`, '');
        placeholder.disabled = true;
        input.append(placeholder);
        options.forEach((option) => input.append(new Option(option.label, option.id)));
    } else {
        input.type = type;
        if (type === 'number') { input.min = '0'; input.max = '2147483647'; input.step = '1'; }
        else input.maxLength = 255;
    }
    input.value = value;
    wrapper.append(input);
    $('fields').append(wrapper);
}

function openEditor(title, buildFields, onSubmit, saveLabel = 'Save') {
    $('dialog-title').textContent = title;
    $('fields').replaceChildren();
    $('form-error').hidden = true;
    $('save-button').textContent = saveLabel;
    submitAction = onSubmit;
    buildFields();
    $('editor').showModal();
    $('fields').querySelector('input, select')?.focus();
}

function editBook(book) {
    openEditor(book ? 'Edit book' : 'Add a book', () => {
        field('title', 'Title', book?.title ?? '');
        field('author', 'Author', book?.author ?? '');
        if (!book) field('copies', 'Available copies', '1', 'number');
    }, async (data) => {
        const body = { title: data.get('title').trim(), author: data.get('author').trim() };
        if (!book) body.copies = Number(data.get('copies'));
        await request(book ? `/books/${book.id}` : '/books', book ? 'PATCH' : 'POST', body);
        return book ? 'Book updated.' : 'Book added.';
    });
}

async function undoBookEdit() {
    if (undoing || saving) return;
    undoing = true;
    const button = $('undo-book-edit');
    button.disabled = true;
    button.textContent = 'Undoing…';
    button.setAttribute('aria-busy', 'true');
    try {
        await request('/books/undo', 'POST');
        // A restored title might no longer match the current search.
        $('search').value = '';
        notify('Last book edit undone. The previous title and author were restored.');
        await loadList();
    } catch (error) {
        notify(error.message, true);
    } finally {
        undoing = false;
        button.disabled = false;
        button.textContent = 'Undo last book edit';
        button.removeAttribute('aria-busy');
    }
}

function editCopies(book) {
    openEditor('Set available copies', () => {
        const help = document.createElement('p');
        help.className = 'help';
        help.textContent = `Enter the new total of available copies for “${book.title}”. This replaces the existing number; it does not add to it.`;
        $('fields').append(help);
        field('copies', 'New available copies', '', 'number');
    }, async (data) => {
        await request(`/books/${book.id}/copies`, 'PATCH', { copies: Number(data.get('copies')) });
        return 'Available copies updated.';
    });
}

function editStudent(student) {
    openEditor(student ? 'Edit student' : 'Register a student', () => {
        field('name', 'Student name', student?.name ?? '');
    }, async (data) => {
        await request(student ? `/students/${student.id}` : '/students', student ? 'PATCH' : 'POST', { name: data.get('name').trim() });
        return student ? 'Student updated.' : 'Student registered.';
    });
}

async function borrowBook(bookId = '') {
    if (preparingBorrow) return;
    preparingBorrow = true;
    const startingVersion = loadVersion;
    try {
        const [books, students] = await Promise.all([request('/books'), request('/students')]);
        if (loadVersion !== startingVersion || $('editor').open) return;
        if (!books.length || !students.length) {
            notify('Add at least one book and register a student before borrowing.', true);
            return;
        }
        openEditor('Borrow a book', () => {
            field('bookId', 'Book', bookId, 'text', books.map((b) => ({ id: b.id, label: `${b.title} — ${b.author} (#${b.id})` })));
            field('studentId', 'Student', '', 'text', students.map((s) => ({ id: s.id, label: `${s.name} (#${s.id})` })));
            const help = document.createElement('p');
            help.className = 'help';
            help.textContent = 'The library checks available copies when you confirm the borrowing.';
            $('fields').append(help);
        }, async (data) => {
            await request('/borrowings', 'POST', { bookId: Number(data.get('bookId')), studentId: Number(data.get('studentId')) });
            return 'Borrowing saved. You can see it in Borrowings.';
        }, 'Confirm borrowing');
    } catch (error) {
        notify(error.message, true);
    } finally {
        preparingBorrow = false;
    }
}

function returnBook(borrowing) {
    if (!Number.isInteger(borrowing.borrowingId) || borrowing.borrowingId <= 0) {
        notify('The server did not provide a borrowing ID. Restart the updated Spring app, then refresh this page.', true);
        return;
    }
    openEditor('Return a book', () => {
        const message = document.createElement('p');
        message.textContent = `Return “${borrowing.bookTitle}” from ${borrowing.studentName}? Borrowing #${borrowing.borrowingId} will be closed and one copy will become available. Waiting students are not automatically assigned that copy.`;
        $('fields').append(message);
    }, async () => {
        await request(`/borrowings/${borrowing.borrowingId}/return`, 'PATCH');
        return 'Book returned. One copy is available again; existing waitlists can be checked in Waitlists.';
    }, 'Confirm return');
}

function viewWaitlist(bookId) {
    waitlistBookId = String(bookId);
    showSection('waitlists');
}

// The API exposes the next entry, not the full queue or its length.
async function loadWaitlist(version) {
    waitlistBook = null;
    nextStudentId = null;
    $('waitlist-book').disabled = true;
    $('add-button').disabled = true;
    $('remove-next').disabled = true;
    $('next-student').textContent = 'Loading waitlist…';
    try {
        const [books, students] = await Promise.all([request('/books'), request('/students')]);
        if (version !== loadVersion) return;
        $('waitlist-book').replaceChildren(new Option('Choose a book…', ''));
        books.forEach((book) => $('waitlist-book').append(new Option(`${book.title} — ${book.author} (#${book.id})`, book.id)));
        waitlistBook = books.find((book) => String(book.id) === waitlistBookId) ?? null;
        waitlistBookId = waitlistBook ? String(waitlistBook.id) : '';
        $('waitlist-book').value = waitlistBookId;
        if (!waitlistBook) {
            $('list-status').textContent = books.length ? 'Select a book to manage its waitlist.' : 'Add a book in Books before creating a waitlist.';
            $('next-student').textContent = 'Choose a book to see who is waiting.';
            return;
        }
        const next = await request(`/books/${waitlistBook.id}/waitlist/next`);
        if (version !== loadVersion) return;
        nextStudentId = next?.studentId ?? null;
        const student = students.find((item) => item.id === nextStudentId);
        $('next-student').textContent = nextStudentId === null ? 'No students waiting.'
            : student ? `${student.name} (#${student.id})` : `Student #${nextStudentId}`;
        $('list-status').textContent = `Waitlist for “${waitlistBook.title}”.`;
        $('add-button').disabled = students.length === 0;
        $('remove-next').disabled = nextStudentId === null;
        if (!students.length) $('list-status').textContent += ' Register a student before joining.';
    } catch (error) {
        if (version !== loadVersion) return;
        $('list-status').textContent = `${error.message} Use Refresh to retry.`;
        $('next-student').textContent = 'Could not load the queue.';
    } finally {
        if (version === loadVersion) $('waitlist-book').disabled = false;
    }
}

async function joinWaitlist() {
    if (!waitlistBook || preparingJoin) return;
    preparingJoin = true;
    const book = waitlistBook;
    const startingVersion = loadVersion;
    try {
        const students = await request('/students');
        if (loadVersion !== startingVersion || $('editor').open) return;
        if (!students.length) {
            notify('Register a student before joining a waitlist.', true);
            return;
        }
        openEditor('Join waitlist', () => {
            const help = document.createElement('p');
            help.className = 'help';
            help.textContent = `Join the queue for “${book.title}”. The book must have zero available copies. A student already waiting will keep their existing place.`;
            $('fields').append(help);
            field('studentId', 'Student', '', 'text', students.map((student) => ({ id: student.id, label: `${student.name} (#${student.id})` })));
        }, async (data) => {
            await request(`/books/${book.id}/waitlist`, 'POST', { studentId: Number(data.get('studentId')) });
            return 'Student is on the waitlist. Existing entries keep their place.';
        }, 'Join waitlist');
    } catch (error) {
        notify(error.message, true);
    } finally {
        preparingJoin = false;
    }
}

function removeNextStudent() {
    if (!waitlistBook || nextStudentId === null) return;
    const book = waitlistBook;
    openEditor('Remove next student?', () => {
        const message = document.createElement('p');
        message.textContent = `Remove the next student from “${book.title}”'s waitlist? This does not borrow or return a book. It removes whoever is first when the request is processed.`;
        $('fields').append(message);
    }, async () => {
        await request(`/books/${book.id}/waitlist/next/remove`, 'POST');
        return 'Next entry removed from the queue. No borrowing was created.';
    }, 'Remove next');
}

function deleteRecord(type, item) {
    const name = item.title ?? item.name;
    openEditor('Delete record?', () => {
        const message = document.createElement('p');
        message.textContent = `Delete “${name}” (#${item.id})? This cannot be undone. Records with borrowing history may not be deleted.`;
        $('fields').append(message);
    }, async () => {
        await request(`/${type}/${item.id}`, 'DELETE');
        return `${type === 'books' ? 'Book' : 'Student'} deleted.`;
    }, 'Delete');
}

$('editor-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const data = new FormData(event.currentTarget);
    const controls = [...event.currentTarget.querySelectorAll('button, input, select')];
    controls.forEach((control) => { control.disabled = true; });
    $('form-error').hidden = true;
    $('editor-form').setAttribute('aria-busy', 'true');
    try {
        const message = await submitAction(data);
        $('editor').close();
        notify(message);
        await loadList();
    } catch (error) {
        if (error.uncertainRemoval) {
            $('editor').close();
            notify(error.message, true);
            await loadList();
            return;
        }
        $('form-error').textContent = error.message;
        $('form-error').hidden = false;
    } finally {
        saving = false;
        controls.forEach((control) => { control.disabled = false; });
        $('editor-form').removeAttribute('aria-busy');
    }
});
$('editor').addEventListener('cancel', (event) => { if (saving) event.preventDefault(); });
$('close-dialog').addEventListener('click', () => $('editor').close());
$('cancel-dialog').addEventListener('click', () => $('editor').close());
$('add-button').addEventListener('click', () => {
    if (section === 'books') editBook();
    else if (section === 'students') editStudent();
    else if (section === 'borrowings') borrowBook();
    else joinWaitlist();
});
$('waitlist-book').addEventListener('change', () => {
    waitlistBookId = $('waitlist-book').value;
    $('notice').hidden = true;
    loadList();
});
$('remove-next').addEventListener('click', removeNextStudent);
$('refresh').addEventListener('click', loadList);
$('undo-book-edit').addEventListener('click', undoBookEdit);
$('search-form').addEventListener('submit', (event) => { event.preventDefault(); loadList(); });
$('search').addEventListener('input', () => { if (!$('search').value) loadList(); });
document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => showSection(button.dataset.section)));
showSection('books');
