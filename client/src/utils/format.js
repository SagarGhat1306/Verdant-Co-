const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const fullFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function formatTime(value) {
  return value ? timeFormat.format(new Date(value)) : '';
}

export function formatDateTime(value) {
  return value ? fullFormat.format(new Date(value)) : '';
}

// "10:42 am" for today, "3 Nov" for older ones.
export function formatRelativeDay(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? timeFormat.format(date) : dateFormat.format(date);
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
