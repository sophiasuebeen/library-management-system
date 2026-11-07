export const demoMode = new URLSearchParams(window.location.search).has('demo');
export const artwork = [
  { title: 'The Creative Act', author: 'Rick Rubin', cover: '/covers/creative-act.png', genre: 'Creativity', year: '2023', pages: 432 },
  { title: 'Pachinko', author: 'Min Jin Lee', cover: '/covers/pachinko.jpg', genre: 'Fiction', year: '2017', pages: 490 },
  { title: 'The Order of Time', author: 'Carlo Rovelli', cover: '/covers/time.jpg', genre: 'Science', year: '2018', pages: 256 },
  { title: 'Ways of Seeing', author: 'John Berger', cover: '/covers/seeing.jpg', genre: 'Art', year: '1972', pages: 176 },
  { title: 'Norwegian Wood', author: 'Haruki Murakami', cover: '/covers/norwegian.jpg', genre: 'Fiction', year: '1987', pages: 296 },
  { title: 'The Midnight Library', author: 'Matt Haig', cover: '/covers/midnight.jpg', genre: 'Fiction', year: '2020', pages: 304 },
  { title: 'Sapiens', author: 'Yuval Noah Harari', cover: '/covers/sapiens.jpg', genre: 'History', year: '2011', pages: 443 },
  { title: "On Earth We’re Briefly Gorgeous", author: 'Ocean Vuong', cover: '/covers/earth.jpg', genre: 'Fiction', year: '2019', pages: 256 },
  { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', cover: '/covers/klara.jpg', genre: 'Fiction', year: '2021', pages: 303 },
];
export function enrich(book, covers = []) {
  const match = artwork.find(a => a.title.toLowerCase() === book.title.toLowerCase());
  const uploaded = covers.find(cover => cover.bookId === book.id);
  const cover = uploaded ? uploaded.url ?? `/books/${book.id}/cover?v=${uploaded.version}` : match?.cover;
  return { ...match, ...book, cover, hasUploadedCover: Boolean(uploaded), genre: match?.genre, year: match?.year, pages: match?.pages };
}
const db = {
  books: artwork.map((book, i) => ({ id: i + 1, title: book.title, author: book.author, availableCopies: i === 3 ? 0 : i === 0 ? 3 : 2 })),
  students: [{ id: 1, name: 'Alex Morgan' }, { id: 2, name: 'Jamie Park' }, { id: 3, name: 'Sam Lee' }],
  borrowings: [{ borrowingId: 1, studentName: 'Jamie Park', bookTitle: 'Ways of Seeing', borrowedDate: '2026-11-01', bookId: 4 }],
  queues: { 4: [1] }, covers: {}, undo: [], next: 100,
};
const clone = value => structuredClone(value);
const fail = message => { throw new Error(message); };
function demoRequest(path, method, data, body) {
  const [, type, rawId, operation, next, remove] = path.split('/');
  const id = Number(rawId);
  if (type === 'books' && rawId === 'covers') return Object.values(db.covers);
  if (type === 'books' && operation === 'cover') {
    if (db.covers[id]) URL.revokeObjectURL(db.covers[id].url);
    if (method === 'PUT') db.covers[id] = { bookId: id, version: db.next++, url: URL.createObjectURL(body) };
    else delete db.covers[id];
    return null;
  }
  if (type === 'books' && rawId === 'undo') {
    const old = db.undo.pop();
    if (!old) fail('There is no book edit to undo.');
    const book = db.books.find(b => b.id === old.id);
    if (!book) fail('The edited book no longer exists.');
    Object.assign(book, old); return null;
  }
  if (type === 'books' && operation === 'waitlist') {
    const book = db.books.find(b => b.id === id);
    if (!book) fail('Book not found.');
    const queue = db.queues[id] ??= [];
    if (method === 'GET') return queue.length ? { studentId: queue[0] } : null;
    if (next === 'next' && remove === 'remove') { queue.shift(); return null; }
    if (book.availableCopies !== 0) fail('Join the waitlist only when no copies are available.');
    if (!db.students.some(s => s.id === data.studentId)) fail('Student not found.');
    if (!queue.includes(data.studentId)) queue.push(data.studentId);
    return null;
  }
  if (type === 'borrowings') {
    if (method === 'GET') return clone(db.borrowings);
    if (operation === 'return') {
      const loan = db.borrowings.find(b => b.borrowingId === id);
      if (loan) { db.books.find(b => b.id === loan.bookId).availableCopies++; db.borrowings = db.borrowings.filter(b => b !== loan); }
      return null;
    }
    const book = db.books.find(b => b.id === data.bookId);
    const student = db.students.find(s => s.id === data.studentId);
    if (!book || !student) fail('Choose an existing book and student.');
    if (!book.availableCopies) fail('No copies are available. Join the waitlist instead.');
    book.availableCopies--;
    db.borrowings.push({ borrowingId: db.next++, bookId: book.id, studentName: student.name, bookTitle: book.title, borrowedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) });
    return null;
  }
  const list = db[type];
  if (!list) fail('Unknown collection.');
  if (method === 'GET') return clone(list);
  if (method === 'POST') { list.push({ id: db.next++, ...data, ...(type === 'books' ? { availableCopies: data.copies } : {}) }); return null; }
  const record = list.find(r => r.id === id);
  if (!record) fail('Record not found.');
  if (method === 'DELETE') {
    if (db.borrowings.some(b => type === 'books' ? b.bookId === id : b.studentName === record.name)) fail('This record has borrowing history.');
    db[type] = list.filter(r => r.id !== id); return null;
  }
  if (operation === 'copies') { record.availableCopies = data.copies; return null; }
  if (type === 'books') db.undo.push({ id, title: record.title, author: record.author });
  Object.assign(record, data); return null;
}
export async function request(path, method = 'GET', data, signal, { body } = {}) {
  if (demoMode) return demoRequest(path, method, data, body);
  let response;
  try {
    response = await fetch(path, { method, signal, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? body : JSON.stringify(data) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const failure = new Error(method === 'GET' ? 'Cannot reach the library. It may be waking up. Wait a moment, then try again.' : 'Connection lost. This action may have completed. Refresh and check the records before trying again.');
    failure.uncertain = method !== 'GET';
    throw failure;
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail || problem.message || ({ 400: 'Check your entries and try again.', 413: 'This image is too large. Covers must be at most 2 MB.', 415: 'Choose a JPEG, PNG or WebP image.', 404: 'This record no longer exists. Refresh the library.', 409: 'This action conflicts with the current records. Check availability and borrowing history.' }[response.status]) || `Library request failed (HTTP ${response.status}).`);
  }
  if (method !== 'GET' || response.status === 204) return null;
  try { return await response.json(); } catch { throw new Error('The library could not load these records. Please try again.'); }
}
