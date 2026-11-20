// Plain text stays plain text; only navigable web URLs become links.
export function messageLinks(text) {
  const parts = [];
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"`]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|id|co|io|app|dev|me|info|edu|gov|xyz)(?:\/[^\s<>"`]*|\?[^\s<>"`]*)?/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index && /[@\w:/.-]/.test(text[match.index - 1])) continue;
    let label = match[0].replace(/[.,!?;:'\u2019\u201d]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (label.endsWith(close) && label.split(close).length > label.split(open).length) label = label.slice(0, -1);
    }
    try {
      const url = new URL(/^https?:\/\//i.test(label) ? label : `https://${label}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) continue;
      if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) });
      parts.push({ text: label, href: url.href });
      cursor = match.index + label.length;
    } catch { /* Retain malformed input as text. */ }
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
