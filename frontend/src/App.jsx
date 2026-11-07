import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MagnifyingGlass, Plus, X, ArrowUpRight } from '@phosphor-icons/react';
import { demoMode, enrich, request } from './data';
import { Orbit } from './Orbit';
import { prepareCover } from './coverImage';

const sections = ['Home', 'Collection', 'Students', 'Borrowings', 'Waitlists'];
const padId = id => String(id).padStart(4, '0');
const countLabel = (count, one, many) => `${String(count).padStart(2, '0')} ${count === 1 ? one : many}`;
const numberField = (name, label, value = 1) => ({ name, label, type: 'number', value });
const selectField = (name, label, items, value = '') => ({ name, label, options: items, value });
function FormDialog({ config, onClose, onComplete }) {
  const dialog = useRef(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const node = dialog.current; node.showModal(); return () => node.close(); }, []);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const entries = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of Object.keys(entries)) entries[key] = typeof entries[key] === 'string' ? entries[key].trim() : entries[key];
    if (Object.values(entries).some(v => !String(v).length)) { setError('Please complete every field.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { await config.action(entries); onComplete(config.success); }
    catch (error) { if (error.uncertain) { onComplete(error.message); return; } setError(error.message); lock.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} onCancel={e => { if (lock.current) e.preventDefault(); else onClose(); }} aria-labelledby="dialog-title">
    <form onSubmit={submit} aria-busy={busy}>
      <div className="dialog-top"><span className="eyebrow">ORBIT LIBRARY</span><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={23}/></button></div>
      <h2 id="dialog-title">{config.title}</h2><p className="dialog-description">{config.description}</p>
      <fieldset disabled={busy}>{config.fields?.map(field => <label className="field" key={field.name}>{field.label}
        {field.options ? <select aria-label={field.label} name={field.name} required defaultValue={field.value}><option value="" disabled>Choose {field.label.toLowerCase()}</option>{field.options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          : field.type === 'file' ? <input aria-label={field.label} name={field.name} type="file" accept={field.accept} required/>
          : <input aria-label={field.label} name={field.name} type={field.type || 'text'} autoComplete={field.type === 'password' ? 'off' : undefined} required defaultValue={field.value ?? ''} min={field.type === 'number' ? 0 : undefined} max={field.type === 'number' ? 2147483647 : undefined} step={field.type === 'number' ? 1 : undefined} maxLength={255}/>}
      </label>)}</fieldset>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : config.label || 'Save changes'}<ArrowRight size={23}/></button>
      <button className="cancel" type="button" disabled={busy} onClick={onClose}>Cancel</button>
    </form>
  </dialog>;
}
function Cover({ book, ...props }) {
  if (book.cover) return <img src={book.cover} alt={`${book.title} cover`} draggable="false" {...props}/>;
  return <span className="uncatalogued-cover" {...props}><strong>{book.title}</strong><span>{book.author}</span><small>Cover not catalogued</small></span>;
}
export function App() {
  const [section, setSection] = useState('Home');
  const [data, setData] = useState({ books: [], students: [], borrowings: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('orbit');
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [queueBookId, setQueueBookId] = useState('');
  const [queue, setQueue] = useState({ loading: false, next: null, error: '' });
  const [queueVersion, setQueueVersion] = useState(0);
  const loadVersion = useRef(0);
  const adminPassword = useRef('');
  async function load() {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError('');
    try {
      // Covers are optional: the library must still load when they cannot be read.
      const [books, students, borrowings, covers] = await Promise.all([request('/books'), request('/students'), request('/borrowings'), request('/books/covers').catch(() => [])]);
      if (version === loadVersion.current) setData({ books: books.map(book => enrich(book, Array.isArray(covers) ? covers : [])), students, borrowings });
    } catch (error) { if (version === loadVersion.current) setLoadError(error.message); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { loadVersion.current++; }; }, []);
  useEffect(() => {
    if (section !== 'Waitlists' || !queueBookId) return;
    const controller = new AbortController();
    setQueue({ loading: true, next: null, error: '' });
    request(`/books/${queueBookId}/waitlist/next`, 'GET', undefined, controller.signal).then(next => { if (!controller.signal.aborted) setQueue({ loading: false, next, error: '' }); }).catch(error => { if (!controller.signal.aborted) setQueue({ loading: false, next: null, error: error.message }); });
    return () => controller.abort();
  }, [section, queueBookId, queueVersion]);
  const books = data.books.filter(b => `${b.title} ${b.author}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = books.find(b => b.id === selectedId) ?? books[0];
  const queueBook = data.books.find(b => String(b.id) === queueBookId);
  const students = data.students.map(s => ({ id: s.id, label: `${s.name} (#${s.id})` }));
  function navigate(name) { setSection(name); setNotice(''); }
  function complete(message) { setForm(null); setNotice(message); setQueueVersion(v => v + 1); load(); }
  function editBook(book) {
    setForm({ title: book ? 'Edit book details.' : 'Add a book.', description: book ? 'Update the title and author in your collection.' : 'Add a new title to the library.', fields: [{ name: 'title', label: 'Title', value: book?.title }, { name: 'author', label: 'Author', value: book?.author }, ...(!book ? [numberField('copies', 'Available copies')] : [])], action: values => request(book ? `/books/${book.id}` : '/books', book ? 'PATCH' : 'POST', { title: values.title, author: values.author, ...(!book ? { copies: Number(values.copies) } : {}) }), success: book ? 'Book details updated.' : 'Book added to the collection.' });
  }
  function editStudent(student) {
    setForm({ title: student ? 'Edit student.' : 'Register a student.', fields: [{ name: 'name', label: 'Student name', value: student?.name }], action: values => request(student ? `/students/${student.id}` : '/students', student ? 'PATCH' : 'POST', values), success: student ? 'Student details updated.' : 'Student registered.' });
  }
  function borrow(book) {
    if (!students.length || !data.books.some(b => b.availableCopies > 0)) { setNotice('Register a student and add a book with available copies before checking out.'); return; }
    setForm({ title: 'Check out a book.', description: 'Choose an available book and the student checking it out.', fields: [selectField('bookId', 'Book', data.books.filter(b => b.availableCopies > 0).map(b => ({ id: b.id, label: b.title })), book?.id ?? ''), selectField('studentId', 'Student', students)], action: values => request('/borrowings', 'POST', { bookId: Number(values.bookId), studentId: Number(values.studentId) }), label: 'Confirm check-out', success: 'Book checked out. Find it in Borrowings.' });
  }
  function join(book) {
    if (!students.length) { setNotice('Register a student before joining a waitlist.'); return; }
    setForm({ title: 'Join the waitlist.', description: `Join the waitlist for “${book.title}”. Existing entries keep their place.`, fields: [selectField('studentId', 'Student', students)], action: values => request(`/books/${book.id}/waitlist`, 'POST', { studentId: Number(values.studentId) }), label: 'Join waitlist', success: 'Student is on the waitlist.' });
  }
  function confirm(title, description, path, method, success) { setForm({ title, description, action: () => request(path, method), label: 'Confirm', success }); }
  function setCopies(book) { setForm({ title: 'Set available copies.', description: 'This replaces the current available count. It does not add to it.', fields: [numberField('copies', 'Available copies', book.availableCopies)], action: values => request(`/books/${book.id}/copies`, 'PATCH', { copies: Number(values.copies) }), success: 'Available copies updated.' }); }
  const passwordFields = () => demoMode || adminPassword.current ? [] : [{ name: 'password', label: 'Admin password', type: 'password' }];
  async function coverRequest(book, method, password, body) {
    const secret = adminPassword.current || password || '';
    if (!demoMode && !/^[\x21-\x7e]+$/.test(secret)) throw new Error('Wrong admin password.');
    try {
      await request(`/books/${book.id}/cover`, method, undefined, undefined, { body, headers: { 'X-Admin-Password': secret } });
      adminPassword.current = secret;
    } catch (error) {
      if (error.message === 'Wrong admin password.') adminPassword.current = '';
      throw error;
    }
  }
  function uploadCover(book) {
    setForm({ title: 'Upload a cover.', description: `Choose a cover for “${book.title}”. It is cropped to the shape of a book.`, fields: [{ name: 'cover', label: 'Cover image', type: 'file', accept: 'image/jpeg,image/png,image/webp' }, ...passwordFields()], action: async values => coverRequest(book, 'PUT', values.password, await prepareCover(values.cover)), label: 'Upload cover', success: 'Cover uploaded.' });
  }
  function removeCover(book) {
    setForm({ title: 'Remove this cover?', description: `Remove the uploaded cover from “${book.title}”.`, fields: passwordFields(), action: values => coverRequest(book, 'DELETE', values.password), label: 'Remove cover', success: 'Cover removed.' });
  }
  function openBook(id) { setSelectedId(id); navigate('Collection'); }
  const totalCopies = data.books.reduce((total, book) => total + book.availableCopies, 0);
  const searchField = <label className="search"><MagnifyingGlass size={24}/><input aria-label="Search collection" type="search" placeholder="Search by title or author" value={query} onChange={e => setQuery(e.target.value)}/></label>;
  const inventoryLine = loading || loadError ? null : <span className="inventory-line">{countLabel(data.books.length, 'TITLE', 'TITLES')} · {totalCopies} {totalCopies === 1 ? 'COPY' : 'COPIES'} ON SHELF</span>;
  const booksFallback = loading ? <div className="empty-state" role="status">Loading books…</div> : loadError ? <ErrorState message={loadError} retry={load}/> : !selected ? <div className="empty-state"><h2>{query ? 'No books found.' : 'No books yet.'}</h2><p>{query ? 'Try another title or author.' : 'Add the first book to the collection.'}</p><button className="text-link" onClick={() => query ? setQuery('') : editBook()}>{query ? 'Clear search' : 'Add a book'}<ArrowRight size={20}/></button></div> : null;
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'short', day: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase();
  return <div className="app-shell">
    <header className="site-header"><button className="brand" onClick={() => navigate('Home')}>Orbit Library</button><nav aria-label="Library sections">{sections.map(name => <button key={name} onClick={() => navigate(name)} aria-current={section === name ? 'page' : undefined}>{name}</button>)}</nav><div className="header-meta"><span>{date}</span></div></header>
    {demoMode ? <div className="demo-banner"><span>DEMO LIBRARY · Resets on refresh</span><a href="/">Connect to live library <ArrowUpRight size={14}/></a></div> : null}
    {notice ? <div className="notice" role="status">{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={18}/></button></div> : null}
    <main>
      <h1 className="visually-hidden">{section}</h1>
      {section === 'Home' ? <section className="home">
        <form className="home-search" role="search" onSubmit={event => { event.preventDefault(); navigate('Collection'); }}>{searchField}{inventoryLine}</form>
        {booksFallback ?? <Orbit books={books} selected={selected} onSelect={setSelectedId} onOpen={openBook}/>}
      </section> : section === 'Collection' ? <>
        <section className="collection-bar">{searchField}{inventoryLine}<button className="text-link view-toggle" onClick={() => setView(view === 'orbit' ? 'list' : 'orbit')}>{view === 'orbit' ? 'View index' : 'View orbit'} <ArrowUpRight size={14}/></button></section>
        {booksFallback ?? <div className="collection-grid">
          <div className="collection-main">{view === 'orbit' ? <Orbit books={books} selected={selected} onSelect={setSelectedId}/> : <div className="book-index">{books.map(book => <button className={`index-book ${book.id === selected.id ? 'active' : ''}`} key={book.id} onClick={() => setSelectedId(book.id)}><Cover book={book}/><span>{book.title}<small>{book.author}</small></span><span>{book.availableCopies} available<ArrowUpRight size={20}/></span></button>)}</div>}</div>
          <section className="record-panel" aria-label="Selected book" aria-live="polite">
            <span className="eyebrow">CATALOG RECORD {padId(selected.id)}</span>
            <h2>{selected.title}</h2>
            <p>{selected.author}</p>
            <dl className="record-list">{selected.genre ? <><div><dt>Genre</dt><dd>{selected.genre}</dd></div><div><dt>Published</dt><dd>{selected.year}</dd></div><div><dt>Pages</dt><dd>{selected.pages}</dd></div></> : null}<div><dt>Available</dt><dd>{selected.availableCopies} {selected.availableCopies === 1 ? 'copy' : 'copies'}</dd></div><div><dt>Status</dt><dd>{selected.availableCopies > 0 ? 'On shelf' : 'Unavailable'}</dd></div></dl>
            <button className="outline-button wide" onClick={() => selected.availableCopies > 0 ? borrow(selected) : join(selected)}>{selected.availableCopies > 0 ? 'Check out' : 'Join waitlist'}</button>
            <div className="record-actions"><button onClick={() => editBook(selected)}>Edit</button><button onClick={() => setCopies(selected)}>Set copies</button><button onClick={() => uploadCover(selected)}>{selected.hasUploadedCover ? 'Replace cover' : 'Upload cover'}</button>{selected.hasUploadedCover ? <button onClick={() => removeCover(selected)}>Remove cover</button> : null}<button onClick={() => { setQueueBookId(String(selected.id)); navigate('Waitlists'); }}>Waitlist</button><button className="danger" onClick={() => confirm('Delete this book?', `Permanently delete “${selected.title}”? Books with borrowing history cannot be deleted.`, `/books/${selected.id}`, 'DELETE', 'Book deleted.')}>Delete</button></div>
          </section>
        </div>}
        <div className="collection-footer"><button className="text-link" onClick={() => editBook()}><Plus size={18}/> Add a book</button><div><button onClick={() => confirm('Undo last book edit?', 'Restore the previous title and author of the most recently edited book. History clears when the server restarts.', '/books/undo', 'POST', 'Last book edit undone.')}>Undo last edit</button><button onClick={load}>Refresh collection</button></div></div>
      </> : <>
        {loading ? <div className="empty-state" role="status">Loading {section.toLowerCase()}…</div> : loadError ? <ErrorState message={loadError} retry={load}/> : section === 'Students' ? <><div className="section-toolbar"><span>{countLabel(data.students.length, 'STUDENT', 'STUDENTS')} REGISTERED</span><div className="toolbar-actions"><button onClick={load}>Refresh</button><button className="outline-button" onClick={() => editStudent()}>Register student<Plus size={20}/></button></div></div><div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Name</th><th>Actions</th></tr></thead><tbody>{data.students.map(s => <tr key={s.id}><td className="mono">{padId(s.id)}</td><td className="record-name">{s.name}</td><td><div className="row-actions"><button onClick={() => editStudent(s)}>Edit<ArrowUpRight size={16}/></button><button onClick={() => confirm('Delete this student?', `Permanently delete ${s.name}? Students with borrowing history cannot be deleted.`, `/students/${s.id}`, 'DELETE', 'Student deleted.')}>Delete</button></div></td></tr>)}</tbody></table>{!data.students.length ? <p className="empty-state">No students registered.</p> : null}</div></> : section === 'Borrowings' ? <><div className="section-toolbar"><span>{countLabel(data.borrowings.length, 'BOOK', 'BOOKS')} CHECKED OUT</span><div className="toolbar-actions"><button onClick={load}>Refresh</button><button className="outline-button" onClick={() => borrow()}>Check out a book<Plus size={20}/></button></div></div><div className="table-scroll"><table><thead><tr><th>Borrowing ID</th><th>Book</th><th>Student</th><th>Borrowed</th><th>Actions</th></tr></thead><tbody>{data.borrowings.map(b => <tr key={b.borrowingId}><td className="mono">{padId(b.borrowingId)}</td><td className="record-name">{b.bookTitle}</td><td>{b.studentName}</td><td>{b.borrowedDate}</td><td><button className="text-link" onClick={() => confirm('Return this book?', `Return “${b.bookTitle}” from ${b.studentName}? One copy will be restored. Waiting students are not automatically assigned it.`, `/borrowings/${b.borrowingId}/return`, 'PATCH', 'Book returned. One copy is available again.')}>Return book<ArrowLeft size={19}/></button></td></tr>)}</tbody></table>{!data.borrowings.length ? <p className="empty-state">No books checked out.</p> : null}</div></> : <section className="waitlist-layout"><div className="waitlist-books"><div className="section-toolbar"><span>SELECT A BOOK TO VIEW ITS QUEUE</span><div className="toolbar-actions"><button onClick={load}>Refresh</button></div></div><div className="table-scroll"><table><thead><tr><th>ID</th><th>Title</th><th>Author</th><th>Available</th></tr></thead><tbody>{data.books.map(b => <tr key={b.id} className={String(b.id) === queueBookId ? 'selected' : undefined} onClick={() => setQueueBookId(String(b.id))}><td className="mono">{padId(b.id)}</td><td className="record-name"><button className="row-select" aria-pressed={String(b.id) === queueBookId}>{b.title}</button></td><td>{b.author}</td><td className="mono">{b.availableCopies}</td></tr>)}</tbody></table>{!data.books.length ? <p className="empty-state">No books in the collection.</p> : null}</div></div><div className="queue-detail"><span className="eyebrow">NEXT IN LINE</span><h2>{!queueBook ? 'Choose a book.' : queue.loading ? 'Checking the queue…' : queue.error ? 'Could not load queue.' : queue.next ? data.students.find(s => s.id === queue.next.studentId)?.name ?? `Student #${queue.next.studentId}` : 'No students waiting.'}</h2>{queue.error ? <p role="alert">{queue.error}</p> : null}<p>{queueBook ? queue.loading ? 'Loading the next student…' : queue.error ? 'Refresh the queue to try again.' : queue.next ? `Waiting for “${queueBook.title}”.` : `No students waiting for “${queueBook.title}”.` : 'Select a book to view its waitlist.'}</p><div className="queue-actions"><button className="outline-button" disabled={!queueBook || queueBook.availableCopies > 0 || !students.length || queue.loading} onClick={() => join(queueBook)}>Join waitlist<ArrowRight size={21}/></button><button disabled={!queue.next || queue.loading || !!queue.error} onClick={() => confirm('Remove the next reader?', 'This removes whoever is first when processed. It does not borrow or return a book. Check the queue before repeating this action.', `/books/${queueBookId}/waitlist/next/remove`, 'POST', 'Next entry removed. No borrowing was created.')}>Remove next</button><button disabled={!queueBook || queue.loading} onClick={() => setQueueVersion(v => v + 1)}>Refresh queue</button></div><p className="help">Waitlists accept students when no copies are available. Queues clear when the server restarts. Returning a book does not automatically assign it to a waiting student.</p></div></section>}
      </>}
    </main>
    <footer className="site-footer"><span>ORBIT LIBRARY / LIBRARY MANAGEMENT SYSTEM</span><span>{demoMode ? 'DEMO COLLECTION' : 'LIVE DATABASE'} <span className="footer-dot">•</span> {new Date().getFullYear()}</span></footer>
    {form ? <FormDialog config={form} onClose={() => setForm(null)} onComplete={complete}/> : null}
  </div>;
}
function ErrorState({ message, retry }) { return <div className="empty-state error-state" role="alert"><h2>Could not load the library.</h2><p>{message}</p><div><button className="text-link" onClick={retry}>Try again<ArrowRight size={20}/></button><a className="text-link" href="/?demo">Explore the demo<ArrowUpRight size={20}/></a></div></div>; }
