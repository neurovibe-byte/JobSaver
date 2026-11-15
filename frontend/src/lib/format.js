/** Human label for an event type, e.g. "no_helmet" -> "No helmet". */
export function typeLabel(t, type) {
  return t.types[type] || type.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function formatTime(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
