// Books without catalogued artwork get a plain typeset cover, never another book's art.
export const TITLE_COVER_SIZE = { width: 552, height: 872 };
const MARGIN = 48;
const TITLE_SIZES = [84, 72, 60, 50, 42];
const TITLE_MAX_LINES = 6;

function splitLongWord(word, measure, maxWidth) {
  const parts = [];
  let part = '';
  for (const character of word) {
    if (part && measure(part + character) > maxWidth) { parts.push(part); part = character; }
    else part += character;
  }
  if (part) parts.push(part);
  return parts;
}

// Returns the wrapped lines and whether the text had to be cut to fit maxLines.
export function wrapLines(text, measure, maxWidth, maxLines) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).flatMap(word => measure(word) > maxWidth ? splitLongWord(word, measure, maxWidth) : [word]);
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${word}`) <= maxWidth) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length <= maxLines) return { lines, truncated: false };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return { lines: kept, truncated: true };
}

export function drawTitleCover(canvas, { title, author }) {
  const { width, height } = TITLE_COVER_SIZE;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const maxWidth = width - MARGIN * 2;
  const measure = text => context.measureText(text).width;
  context.fillStyle = '#efece4';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#0b0b0b';
  context.textBaseline = 'top';

  context.font = '500 40px "DM Sans", Arial, sans-serif';
  const authorLines = wrapLines(author, measure, maxWidth, 3).lines;
  const authorTop = height - MARGIN - authorLines.length * 48;
  authorLines.forEach((line, index) => context.fillText(line, MARGIN, authorTop + index * 48));
  context.fillRect(MARGIN, authorTop - 24, maxWidth, 2);

  let wrapped;
  let size;
  for (size of TITLE_SIZES) {
    context.font = `600 ${size}px "DM Sans", Arial, sans-serif`;
    wrapped = wrapLines(title, measure, maxWidth, TITLE_MAX_LINES);
    if (!wrapped.truncated && wrapped.lines.length * size * 1.08 <= authorTop - 24 - MARGIN * 2) break;
  }
  wrapped.lines.forEach((line, index) => context.fillText(line, MARGIN, MARGIN + index * size * 1.08));
}
