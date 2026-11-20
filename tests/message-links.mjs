import assert from 'node:assert/strict';
import fs from 'node:fs';
const { messageLinks } = await import('data:text/javascript;base64,'+fs.readFileSync(new URL('../lib/message-links.js',import.meta.url)).toString('base64'));
for (const text of ['Lihat https://example.com/path?a=1&b=2.\nLalu www.spotify.com!', '(https://en.wikipedia.org/wiki/Function_(mathematics)).', 'Buka example.id/test']) {
 const parts=messageLinks(text); assert.equal(parts.map(p=>p.text).join(''),text); assert.ok(parts.some(p=>p.href));
 for(const p of parts.filter(p=>p.href)) assert.match(p.href,/^https?:\/\//);
}
for(const text of ['javascript:alert(1)','test@example.com','https://user:secret@example.com','ftp://example.com','<script>alert(1)</script>']) {
 assert.ok(!messageLinks(text).some(p=>p.href),text);
 assert.equal(messageLinks(text).map(p=>p.text).join(''),text);
}
assert.equal(messageLinks('(https://example.com).')[1].href,'https://example.com/');
console.log('PASS: web URLs clickable, punctuation and text preserved, email and unsafe schemes excluded');
