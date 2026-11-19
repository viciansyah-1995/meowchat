'use client';

import { useEffect } from 'react';
import { expressionDetails, REACTIONS } from '../lib/chat-expressions.js';

export function ExpressionMessage({ message }) {
  const expression = expressionDetails(message);
  if (!expression) return null;
  return message.message_type === 'sticker'
    ? <img className="message-sticker" src={expression.src} alt={`Stiker ${expression.label}`} />
    : <span className="message-reaction" role="img" aria-label={`Reaksi ${expression.label}`}>{expression.emoji}</span>;
}

export function RoomReaction({ reaction, onEnd }) {
  useEffect(() => {
    const timer = window.setTimeout(onEnd, 2400);
    return () => window.clearTimeout(timer);
  }, [onEnd]);

  const choice = REACTIONS.find((item) => item.id === reaction.expression_key);
  if (!choice) return null;
  return (
    <div className="room-reaction-effect" aria-hidden="true" data-reaction={choice.id}>
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index} style={{
          '--particle-x': `${(index * 37 + 9) % 100}%`,
          '--particle-y': `${(index * 29 + 5) % 100}%`,
          '--particle-delay': `${(index % 6) * 70}ms`,
          '--particle-size': `${28 + (index % 4) * 12}px`,
          '--particle-rotate': `${(index % 2 ? 1 : -1) * 18}deg`,
        }}>{choice.emoji}</span>
      ))}
    </div>
  );
}
