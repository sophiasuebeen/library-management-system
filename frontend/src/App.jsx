import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MagnifyingGlass, Plus, X, ArrowUpRight } from '@phosphor-icons/react';
import { demoMode, enrich, request } from './data';
import { Orbit } from './Orbit';

const sections = ['Collection', 'Students', 'Borrowings', 'Waitlists'];
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
      <div className="dialog-top"><span className="eyebrow">THE LIBRARY DESK</span><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={23}/></button></div>
      <h2 id="dialog-title">{config.title}</h2><p className="dialog-description">{config.description}</p>
      <fieldset disabled={busy}>{config.fields?.map(field => <label className="field" key={field.name}>{field.label}
        {field.options ? <select aria-label={field.label} name={field.name} required defaultValue={field.value}><option value="" disabled>Choose {field.label.toLowerCase()}</option>{field.options.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
          : <input aria-label={field.label} name={field.name} type={field.type || 'text'} required defaultValue={field.value ?? ''} min={field.type === 'number' ? 0 : undefined} max={field.type === 'number' ? 2147483647 : undefined} step={field.type === 'number' ? 1 : undefined} maxLength={255}/>}
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
  const [section, setSection] = useState('Collection');
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
  async function load() {
    const version = ++loadVersion.current;
    setLoading(true); setLoadError('');
    try {
      const [books, students, borrowings] = await Promise.all([request('/books'), request('/students'), request('/borrowings')]);
      if (version === loadVersion.current) setData({ books: books.map(enrich), students, borrowings });
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
    if (!students.length || !data.books.some(b => b.availableCopies > 0)) { setNotice('Register a student and add a book with available copies before borrowing.'); return; }
    setForm({ title: 'Borrow a book.', description: 'Choose an available book and the student borrowing it.', fields: [selectField('bookId', 'Book', data.books.filter(b => b.availableCopies > 0).map(b => ({ id: b.id, label: b.title })), book?.id ?? ''), selectField('studentId', 'Student', students)], action: values => request('/borrowings', 'POST', { bookId: Number(values.bookId), studentId: Number(values.studentId) }), label: 'Confirm borrowing', success: 'Book borrowed. Find it in Borrowings.' });
  }
  function join(book) {
    if (!students.length) { setNotice('Register a student before joining a waitlist.'); return; }
    setForm({ title: 'Join the waitlist.', description: `Join the waitlist for “${book.title}”. Existing entries keep their place.`, fields: [selectField('studentId', 'Student', students)], action: values => request(`/books/${book.id}/waitlist`, 'POST', { studentId: Number(values.studentId) }), label: 'Join waitlist', success: 'Student is on the waitlist.' });
  }
  function confirm(title, description, path, method, success) { setForm({ title, description, action: () => request(path, method), label: 'Confirm', success }); }
  function setCopies(book) { setForm({ title: 'Set available copies.', description: 'This replaces the current available count. It does not add to it.', fields: [numberField('copies', 'Available copies', book.availableCopies)], action: values => request(`/books/${book.id}/copies`, 'PATCH', { copies: Number(values.copies) }), success: 'Available copies updated.' }); }
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'short', day: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase();
  return <div className="app-shell">
    <header className="site-header"><button className="brand" onClick={() => navigate('Collection')}>Orbit Library</button><nav aria-label="Library sections">{sections.map(name => <button key={name} onClick={() => navigate(name)} aria-current={section === name ? 'page' : undefined}>{name}</button>)}</nav><div className="header-meta"><span>{date}</span><span>ASIA/SEOUL</span></div></header>
    {demoMode ? <div className="demo-banner"><span>DEMO LIBRARY · Resets on refresh</span><a href="/">Connect to live library <ArrowUpRight size={14}/></a></div> : null}
    {notice ? <div className="notice" role="status">{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={18}/></button></div> : null}
    <main>
      {section === 'Collection' ? <>
        <section className="hero-heading"><h1>A world,<br/><span>within reach.</span></h1><div className="search-wrap"><label className="search"><MagnifyingGlass size={28} weight="regular"/><input aria-label="Search collection" type="search" placeholder="Search by title or author" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="search-meta"><span>{data.books.length.toString().padStart(2, '0')} STORIES AND COUNTING</span><button className="text-link" onClick={() => setView(view === 'orbit' ? 'list' : 'orbit')}>{view === 'orbit' ? 'View index' : 'View orbit'} <ArrowUpRight size={14}/></button></div></div></section>
        {loading ? <div className="empty-state" role="status">Opening the library…</div> : loadError ? <ErrorState message={loadError} retry={load}/> : !selected ? <div className="empty-state"><h2>{query ? 'No stories found.' : 'Your next chapter starts here.'}</h2><p>{query ? 'Try another title or author.' : 'Add the first book to your collection.'}</p><button className="text-link" onClick={() => query ? setQuery('') : editBook()}>{query ? 'Clear search' : 'Add a book'}<ArrowRight size={20}/></button></div> : <>
          {view === 'orbit' ? <Orbit books={books} selected={selected} onSelect={setSelectedId}/> : <div className="book-index">{books.map(book => <button className={`index-book ${book.id === selected.id ? 'active' : ''}`} key={book.id} onClick={() => { setSelectedId(book.id); setView('orbit'); }}><Cover book={book}/><span>{book.title}<small>{book.author}</small></span><span>{book.availableCopies} available<ArrowUpRight size={20}/></span></button>)}</div>}
          <section className="selected-book" aria-label="Selected book" aria-live="polite"><div className="book-heading"><h2>{selected.title}</h2><p>{selected.author}</p></div><dl className="book-meta">{selected.genre ? <><dt>GENRE</dt><dd>{selected.genre}</dd><dt>PUBLISHED</dt><dd>{selected.year}</dd><dt>PAGES</dt><dd>{selected.pages}</dd></> : <><dt>CATALOG</dt><dd>Library collection</dd></>}<dt>BOOK ID</dt><dd>{String(selected.id).padStart(4, '0')}</dd></dl><div className="borrow-action"><p>{selected.availableCopies === 0 ? 'No copies available' : `${selected.availableCopies} ${selected.availableCopies === 1 ? 'copy' : 'copies'} available`}</p><button className="primary" onClick={() => selected.availableCopies > 0 ? borrow(selected) : join(selected)}>{selected.availableCopies > 0 ? 'Borrow book' : 'Join waitlist'}<ArrowRight size={29} weight="thin"/></button></div></section>
          <div className="collection-tools"><span className="eyebrow">A LITTLE SPACE FOR BIG IDEAS.</span><div><button onClick={() => editBook(selected)}>Edit book</button><button onClick={() => setCopies(selected)}>Set copies</button><button onClick={() => { setQueueBookId(String(selected.id)); navigate('Waitlists'); }}>View waitlist</button><button onClick={() => confirm('Delete this book?', `Permanently delete “${selected.title}”? Books with borrowing history cannot be deleted.`, `/books/${selected.id}`, 'DELETE', 'Book deleted.')}>Delete</button></div></div>
        </>}
        <div className="collection-footer"><button className="text-link" onClick={() => editBook()}><Plus size={18}/> Add a book</button><div><button onClick={() => confirm('Undo last book edit?', 'Restore the previous title and author of the most recently edited book. History clears when the server restarts.', '/books/undo', 'POST', 'Last book edit undone.')}>Undo last edit</button><button onClick={load}>Refresh collection</button></div></div>
      </> : <>
        <section className="management-heading"><div><span className="eyebrow">THE LIBRARY DESK / {section.toUpperCase()}</span><h1>{section === 'Students' ? 'Curious minds.' : section === 'Borrowings' ? 'Out in the world.' : 'Worth the wait.'}</h1><p>{section === 'Students' ? 'The people behind every borrowed story.' : section === 'Borrowings' ? 'Keep each chapter moving.' : 'A place in line for the next great read.'}</p></div><button className="text-link" onClick={load}>Refresh<ArrowRight size={19}/></button></section>
        {loading ? <div className="empty-state" role="status">Loading {section.toLowerCase()}…</div> : loadError ? <ErrorState message={loadError} retry={load}/> : section === 'Students' ? <><div className="section-toolbar"><span>{data.students.length} REGISTERED READERS</span><button className="primary compact" onClick={() => editStudent()}>Register student<Plus size={20}/></button></div><div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Name</th><th>Actions</th></tr></thead><tbody>{data.students.map(s => <tr key={s.id}><td className="mono">{String(s.id).padStart(4, '0')}</td><td className="record-name">{s.name}</td><td><div className="row-actions"><button onClick={() => editStudent(s)}>Edit<ArrowUpRight size={16}/></button><button onClick={() => confirm('Delete this student?', `Permanently delete ${s.name}? Students with borrowing history cannot be deleted.`, `/students/${s.id}`, 'DELETE', 'Student deleted.')}>Delete</button></div></td></tr>)}</tbody></table>{!data.students.length ? <p className="empty-state">No readers yet. Register your first student.</p> : null}</div></> : section === 'Borrowings' ? <><div className="section-toolbar"><span>{data.borrowings.length} CURRENT BORROWINGS</span><button className="primary compact" onClick={() => borrow()}>Borrow a book<Plus size={20}/></button></div><div className="table-scroll"><table><thead><tr><th>Borrowing ID</th><th>Book / Reader</th><th>Borrowed</th><th>Actions</th></tr></thead><tbody>{data.borrowings.map(b => <tr key={b.borrowingId}><td className="mono">{String(b.borrowingId).padStart(4, '0')}</td><td className="record-name">{b.bookTitle}<small>{b.studentName}</small></td><td>{b.borrowedDate}</td><td><button className="text-link" onClick={() => confirm('Return this book?', `Return “${b.bookTitle}” from ${b.studentName}? One copy will be restored. Waiting students are not automatically assigned it.`, `/borrowings/${b.borrowingId}/return`, 'PATCH', 'Book returned. One copy is available again.')}>Return book<ArrowLeft size={19}/></button></td></tr>)}</tbody></table>{!data.borrowings.length ? <p className="empty-state">Every story is home. No current borrowings.</p> : null}</div></> : <section className="waitlist-layout"><div><label className="field">Choose a book<select value={queueBookId} onChange={e => setQueueBookId(e.target.value)}><option value="">Select from the collection</option>{data.books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label><p className="help">Waitlists accept students when no copies are available. Each book has its own queue.</p></div><div className="queue-detail"><span className="eyebrow">NEXT IN LINE</span><h2>{!queueBook ? 'Choose a book.' : queue.loading ? 'Checking the queue…' : queue.error ? 'Could not load queue.' : queue.next ? data.students.find(s => s.id === queue.next.studentId)?.name ?? `Student #${queue.next.studentId}` : 'No students waiting.'}</h2>{queue.error ? <p role="alert">{queue.error}</p> : null}<p>{queueBook ? queue.loading ? 'Loading the next student…' : queue.error ? 'Refresh the queue to try again.' : queue.next ? `Waiting for “${queueBook.title}”.` : `No students waiting for “${queueBook.title}”.` : 'Select a book to view its waitlist.'}</p><div className="queue-actions"><button className="primary compact" disabled={!queueBook || queueBook.availableCopies > 0 || !students.length || queue.loading} onClick={() => join(queueBook)}>Join waitlist<ArrowRight size={21}/></button><button disabled={!queue.next || queue.loading || !!queue.error} onClick={() => confirm('Remove the next reader?', 'This removes whoever is first when processed. It does not borrow or return a book. Check the queue before repeating this action.', `/books/${queueBookId}/waitlist/next/remove`, 'POST', 'Next entry removed. No borrowing was created.')}>Remove next</button><button disabled={!queueBook || queue.loading} onClick={() => setQueueVersion(v => v + 1)}>Refresh queue</button></div><p className="help">Queues clear when the server restarts. Returning a book does not automatically assign it to a waiting reader.</p></div></section>}
      </>}
    </main>
    <footer className="site-footer"><span>MY LIBRARY / A WORLD WITHIN REACH</span><span>{demoMode ? 'DEMO COLLECTION' : 'YOUR LIBRARY, CONNECTED'} <span className="footer-dot">•</span> {new Date().getFullYear()}</span></footer>
    {form ? <FormDialog config={form} onClose={() => setForm(null)} onComplete={complete}/> : null}
  </div>;
}
function ErrorState({ message, retry }) { return <div className="empty-state error-state" role="alert"><h2>The library is taking a pause.</h2><p>{message}</p><div><button className="text-link" onClick={retry}>Try again<ArrowRight size={20}/></button><a className="text-link" href="/?demo">Explore the demo<ArrowUpRight size={20}/></a></div></div>; }
