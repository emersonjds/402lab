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

export const resetsInLabel = (now = Date.now()): string => {
  const today = new Date(now);
  const nextUtcMidnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + 1,
  );
  const minutesLeft = Math.max(0, Math.floor((nextUtcMidnight - now) / 60_000));

  return `${String(Math.floor(minutesLeft / 60))}h ${String(minutesLeft % 60)}m`;
};
