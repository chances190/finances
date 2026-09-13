export function parseNaturalDate(text: string): string | null {
  const lower = text.trim().toLowerCase()

  if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) return lower

  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()

  if (lower === 'today') return toISO(today)
  if (lower === 'yesterday') return toISO(new Date(y, m, d - 1))
  if (lower === 'tomorrow') return toISO(new Date(y, m, d + 1))

  const daysAgo = lower.match(/^(\d+)\s*days?\s*ago$/)
  if (daysAgo) return toISO(new Date(y, m, d - Number(daysAgo[1])))

  const weeksAgo = lower.match(/^(\d+)\s*weeks?\s*ago$/)
  if (weeksAgo) return toISO(new Date(y, m, d - Number(weeksAgo[1]) * 7))

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayDow = today.getDay()
  for (const [i, name] of dayNames.entries()) {
    if (lower === `last ${name}`) {
      const diff = (todayDow - i + 7) % 7 || 7
      return toISO(new Date(y, m, d - diff))
    }
    if (lower === `next ${name}`) {
      const diff = (i - todayDow + 7) % 7 || 7
      return toISO(new Date(y, m, d + diff))
    }
  }

  if (lower === 'last month') {
    const prev = new Date(y, m - 1, 1)
    return toISO(prev)
  }
  if (lower === 'next month') {
    const next = new Date(y, m + 1, 1)
    return toISO(next)
  }
  if (lower === 'this month') {
    const first = new Date(y, m, 1)
    return toISO(first)
  }

  const ddmm = lower.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (ddmm) {
    const day = Number(ddmm[1])
    const month = Number(ddmm[2]) - 1
    return toISO(new Date(y, month, day))
  }

  return null
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
