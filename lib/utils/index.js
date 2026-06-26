export { generateId } from './generateId.js';
export { formatTime, formatDate, formatDateTime, formatRelativeTime } from './timeFormat.js';

// Get initials from name
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Simple validation
export function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

export function isValidPassword(password) {
  return password && password.length >= 6;
}

export function isValidDisplayName(name) {
  return name && name.trim().length >= 1 && name.trim().length <= 50;
}