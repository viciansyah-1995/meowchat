export const REACTIONS = [
  { id: 'love', label: 'Love', emoji: '❤️' },
  { id: 'kiss', label: 'Kiss', emoji: '😘' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
];

export const STICKERS = [
  { id: 'happy', label: 'Senang', src: '/stickers/happy.png' },
  { id: 'love', label: 'Sayang', src: '/stickers/love.png' },
  { id: 'sad', label: 'Sedih', src: '/stickers/sad.png' },
  { id: 'angry', label: 'Kesal', src: '/stickers/angry.png' },
  { id: 'sleepy', label: 'Mengantuk', src: '/stickers/sleepy.png' },
  { id: 'kiss', label: 'Kiss', src: '/stickers/kiss.png' },
  { id: 'hug', label: 'Hug', src: '/stickers/hug.png' },
];

export function expressionDetails(message) {
  const choices = message.message_type === 'reaction' ? REACTIONS : message.message_type === 'sticker' ? STICKERS : [];
  return choices.find((choice) => choice.id === message.expression_key);
}

export function expressionPreview(message) {
  const choice = expressionDetails(message);
  if (!choice) return '';
  return message.message_type === 'reaction' ? `${choice.emoji} ${choice.label}` : `Stiker · ${choice.label}`;
}
