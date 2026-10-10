export const timeAgo = (iso: string, now = Date.now()): string => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));

  if (seconds < 60) {
    return `${String(seconds)}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${String(minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${String(hours)}h ago`;
  }

  return `${String(Math.floor(hours / 24))}d ago`;
};
