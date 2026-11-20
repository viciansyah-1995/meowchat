export function spotifyTrackId(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.username || url.password || url.port) return null;
    return url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/)?.[1] || null;
  } catch { return null; }
}

export function spotifyTrackUrl(id) {
  return `https://open.spotify.com/track/${id}`;
}
