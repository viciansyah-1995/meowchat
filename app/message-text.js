import { messageLinks } from '../lib/message-links.js';

export default function MessageText({ text }) {
  return <>{messageLinks(text).map((part, index) => part.href
    ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{part.text}</a>
    : part.text)}</>;
}
