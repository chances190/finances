const DAY_OFFSETS: Record<string, number> = {
  hoje: 0,
  ontem: -1,
  anteontem: -2,
  amanhã: 1,
  amanha: 1,
  'depois de amanhã': 2,
  'depois de amanha': 2,
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  dom: 0,
  segunda: 1,
  'segunda-feira': 1,
  seg: 1,
  terça: 2,
  'terça-feira': 2,
  terca: 2,
  'terca-feira': 2,
  ter: 2,
  quarta: 3,
  'quarta-feira': 3,
  qua: 3,
  quinta: 4,
  'quinta-feira': 4,
  qui: 4,
  sexta: 5,
  'sexta-feira': 5,
  sex: 5,
  sábado: 6,
  sabado: 6,
  sáb: 6,
  sab: 6,
}

const MONTH_INDEX: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
}

function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function shifted(days: number): string {
  const date = startOfToday()
  date.setDate(date.getDate() + days)
  return toISO(date)
}

function inMonth(month: number, day: number, year?: number): string {
  if (year !== undefined) return toISO(new Date(year, month, day))
  const today = startOfToday()
  const candidate = new Date(today.getFullYear(), month, day)
  return toISO(candidate < today ? new Date(today.getFullYear() + 1, month, day) : candidate)
}

function mostRecentWeekday(weekday: number): string {
  const today = startOfToday()
  today.setDate(today.getDate() - ((today.getDay() - weekday + 7) % 7))
  return toISO(today)
}

function weekdayOfWeek(weeks: number): (weekday: number) => string {
  const monday = startOfToday()
  const offset = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - offset)
  return (weekday: number) => {
    const target = new Date(monday)
    target.setDate(target.getDate() + weeks * 7 + ((weekday + 6) % 7))
    return toISO(target)
  }
}

export function parsePortugueseDate(text: string): string | null {
  const form = text.trim().toLowerCase().replace(/\s+/g, ' ')

  if (form in DAY_OFFSETS) return shifted(DAY_OFFSETS[form])

  const iso = form.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) return toISO(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))

  const shortDate = form.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (shortDate) return inMonth(Number(shortDate[1]) - 1, Number(shortDate[2]))

  const absolute = form.match(/^(\d{1,2}) de (\p{L}+) de (\d{4})$/u)
  if (absolute) {
    const month = MONTH_INDEX[absolute[2]]
    if (month === undefined) return null
    return toISO(new Date(Number(absolute[3]), month, Number(absolute[1])))
  }

  const dayMonth = form.match(/^(\d{1,2}) de (\p{L}+)$/u)
  if (dayMonth) {
    const month = MONTH_INDEX[dayMonth[2]]
    if (month === undefined) return null
    return inMonth(month, Number(dayMonth[1]))
  }

  const dayAbbr = form.match(/^(\d{1,2}) (\p{L}+)\.?$/u)
  if (dayAbbr) {
    const month = MONTH_INDEX[dayAbbr[2]]
    if (month === undefined) return null
    return inMonth(month, Number(dayAbbr[1]))
  }

  const prefixed = form.match(/^(pr[oó]xim[ao]s?|[uú]ltim[ao]s?|esta|esse|essa) (\p{L}+)$/u)
  if (prefixed) {
    const weekday = WEEKDAY_INDEX[prefixed[2]]
    if (weekday === undefined) return null
    if (/^[uú]ltim/.test(prefixed[1])) return weekdayOfWeek(-1)(weekday)
    if (/^pr/.test(prefixed[1])) return weekdayOfWeek(1)(weekday)
    return weekdayOfWeek(0)(weekday)
  }

  const suffixed = form.match(/^(\p{L}+) (passada|retrasada|atrasada|que vem)$/u)
  if (suffixed) {
    const weekday = WEEKDAY_INDEX[suffixed[1]]
    if (weekday === undefined) return null
    if (suffixed[2] === 'que vem') return weekdayOfWeek(1)(weekday)
    if (suffixed[2] === 'passada') return weekdayOfWeek(-1)(weekday)
    return weekdayOfWeek(-2)(weekday)
  }

  const bare = WEEKDAY_INDEX[form]
  if (bare !== undefined) return mostRecentWeekday(bare)

  return null
}
