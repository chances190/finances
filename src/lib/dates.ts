const SUGGESTION_LIMIT = 10

const WEEKDAY_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const WEEKDAY_FEIRA = [
  'segunda-feira',
  'terça-feira',
  'terca-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
]
const WEEKDAY_ALIASES = ['terca', 'sabado']
const WEEKDAY_ABBR_INDEX: [string, number][] = [
  ['dom', 0],
  ['seg', 1],
  ['ter', 2],
  ['qua', 3],
  ['qui', 4],
  ['sex', 5],
  ['sáb', 6],
  ['sab', 6],
]
const WEEKDAY_ABBR = WEEKDAY_ABBR_INDEX.map(([name]) => name)
const WEEKDAYS = [...WEEKDAY_FEIRA, ...WEEKDAY_FULL, ...WEEKDAY_ALIASES, ...WEEKDAY_ABBR]

const MONTH_FULL = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const MONTH_ABBR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]
const MONTHS_WITH_ABBR = [...MONTH_FULL, 'marco', ...MONTH_ABBR]

const STANDALONE_KEYWORDS = ['hoje', 'ontem', 'anteontem', 'amanhã', 'amanha']
const MULTIWORD_KEYWORDS = ['depois de amanhã', 'depois de amanha']

const WEEKDAY_INDEX: Record<string, number> = {}
WEEKDAY_FULL.forEach((name, index) => {
  WEEKDAY_INDEX[name] = index
})
const WEEKDAY_STEM: Record<string, number> = {
  segunda: 1,
  terça: 2,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
}
for (const name of WEEKDAY_FEIRA) {
  WEEKDAY_INDEX[name] = WEEKDAY_STEM[name.split('-')[0]]
}
WEEKDAY_INDEX.terca = 2
WEEKDAY_INDEX.sabado = 6
for (const [name, index] of WEEKDAY_ABBR_INDEX) {
  WEEKDAY_INDEX[name] = index
}

const MONTH_INDEX: Record<string, number> = {}
MONTH_FULL.forEach((name, index) => {
  MONTH_INDEX[name] = index
})
MONTH_INDEX.marco = 2
MONTH_ABBR.forEach((name, index) => {
  MONTH_INDEX[name] = index
})

const DAY_OFFSETS: Record<string, number> = {
  hoje: 0,
  ontem: -1,
  anteontem: -2,
  amanhã: 1,
  amanha: 1,
  'depois de amanhã': 2,
  'depois de amanha': 2,
}

export interface DateMatch {
  end: number
  provisional: boolean
}

function alternation(parts: string[]): string {
  return `(?:${[...new Set(parts)].sort((a, b) => b.length - a.length).join('|')})`
}

const DATE_PATTERNS: { re: RegExp; provisional: boolean }[] = [
  { re: /\d{4}[-/]\d{1,2}[-/]\d{1,2}/iuy, provisional: false },
  { re: /\d{1,2}[-/]\d{1,2}/iuy, provisional: false },
  {
    re: new RegExp(
      String.raw`\d{1,2}\s+(?:de\s+)?${alternation(MONTHS_WITH_ABBR)}(?:\s+(?:de\s+)?\d{4}(?![.,]\d))?`,
      'iyu',
    ),
    provisional: false,
  },
  { re: /depois\s+de\s+amanh[ãa]/iuy, provisional: false },
  {
    re: new RegExp(String.raw`pr[oó]xim[ao]s?\s+${alternation(WEEKDAYS)}`, 'iyu'),
    provisional: false,
  },
  {
    re: new RegExp(
      String.raw`(?:[uú]ltim[ao]s?|esta|este|esse|essa)\s+${alternation(WEEKDAYS)}`,
      'iyu',
    ),
    provisional: false,
  },
  {
    re: new RegExp(
      String.raw`${alternation(WEEKDAYS)}\s+(?:passada|retrasada|atrasada|que\s+vem)`,
      'iyu',
    ),
    provisional: false,
  },
  { re: new RegExp(alternation(WEEKDAYS), 'iyu'), provisional: true },
  { re: new RegExp(alternation(STANDALONE_KEYWORDS), 'iyu'), provisional: true },
]

export function matchDateAt(text: string, index: number): DateMatch | null {
  let best: DateMatch | null = null
  for (const { re, provisional } of DATE_PATTERNS) {
    re.lastIndex = index
    const match = re.exec(text)
    if (!match) continue
    if (best === null || match[0].length > best.end - index) {
      best = { end: index + match[0].length, provisional }
    }
  }
  return best
}

function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function shifted(days: number): string {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  return toISO(date)
}

function inMonth(month: number, day: number, year?: number): string {
  return toISO(new Date(year ?? new Date().getFullYear(), month, day))
}

function mostRecentWeekday(weekday: number): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  today.setDate(today.getDate() - ((today.getDay() - weekday + 7) % 7))
  return toISO(today)
}

function weekdayOfWeek(weeks: number): (weekday: number) => string {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return (weekday: number) => {
    const target = new Date(monday)
    target.setDate(target.getDate() + weeks * 7 + ((weekday + 6) % 7))
    return toISO(target)
  }
}

export function parsePortugueseDate(text: string): string | null {
  const form = normalize(text)

  if (form in DAY_OFFSETS) return shifted(DAY_OFFSETS[form])

  const iso = form.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) return toISO(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))

  const shortDate = form.match(/^(\d{1,2})[-/](\d{1,2})$/)
  if (shortDate) return inMonth(Number(shortDate[1]) - 1, Number(shortDate[2]))

  const calendar = form.match(/^(\d{1,2})\s+(?:de\s+)?(\p{L}+)\.?(?:\s+(?:de\s+)?(\d{4}))?$/u)
  if (calendar) {
    const month = MONTH_INDEX[calendar[2]]
    if (month === undefined) return null
    return inMonth(month, Number(calendar[1]), calendar[3] ? Number(calendar[3]) : undefined)
  }

  const prefixed = form.match(/^(pr[oó]xim[ao]s?|[uú]ltim[ao]s?|esta|este|esse|essa) (\p{L}+)$/u)
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

function namedForms(): string[] {
  const forms: string[] = [
    ...WEEKDAY_FULL,
    ...WEEKDAY_FEIRA,
    ...WEEKDAY_ABBR,
    ...MULTIWORD_KEYWORDS,
  ]
  for (const day of [...WEEKDAY_FULL, ...WEEKDAY_ABBR]) {
    forms.push(
      `${day} passada`,
      `${day} atrasada`,
      `${day} retrasada`,
      `${day} que vem`,
      `próxima ${day}`,
      `última ${day}`,
      `esta ${day}`,
    )
  }
  return forms
}

const NAMED_FORMS = namedForms()
const ALL_FORMS = [...STANDALONE_KEYWORDS, 'depois de amanhã', ...NAMED_FORMS]

function isStandaloneKeywordPrefix(form: string): boolean {
  const needle = normalize(form)
  return needle !== '' && STANDALONE_KEYWORDS.some((keyword) => keyword.startsWith(needle))
}

function isCompleteMonth(value: string): boolean {
  return MONTHS_WITH_ABBR.includes(value)
}

function orderMonths(partial: string): string[] {
  const offset = new Date().getMonth()
  const out: string[] = []
  for (let step = 0; step < 12; step++) {
    const index = (offset + step) % 12
    const full = MONTH_FULL[index]
    const abbr = MONTH_ABBR[index]
    if (full.startsWith(partial) && full.length > partial.length) out.push(full)
    if (partial !== '' && abbr.startsWith(partial) && abbr.length > partial.length) out.push(abbr)
  }
  return out
}

function orderMonthNumbers(partial: string): string[] {
  const offset = new Date().getMonth()
  const out: string[] = []
  for (let step = 0; step < 12; step++) {
    const month = ((offset + step) % 12) + 1
    const padded = String(month).padStart(2, '0')
    if (padded.startsWith(partial)) out.push(padded)
  }
  return out
}

function orderDays(partial: string): string[] {
  const start = new Date().getDate()
  const out: string[] = []
  for (let step = 0; step < 31; step++) {
    const day = String(((start - 1 + step) % 31) + 1).padStart(2, '0')
    if (day.startsWith(partial)) out.push(day)
  }
  return out
}

function yearForms(prefix: string, partial: string, separator = ' de '): string[] {
  const current = new Date().getFullYear()
  const out: string[] = []
  for (let year = current; year <= current + 5 && out.length < SUGGESTION_LIMIT; year++) {
    if (String(year).startsWith(partial)) out.push(`${prefix}${separator}${year}`)
  }
  return out
}

function numericCompletions(form: string): string[] {
  const iso = form.match(/^(\d{4})([-/])(\d{1,2})([-/])(\d*)$/)
  if (iso) {
    const [, year, first, month, second, tail] = iso
    return orderDays(tail).map((value) => `${year}${first}${month}${second}${value}`)
  }

  const yearPrefix = form.match(/^(\d{4})([-/])(\d*)$/)
  if (yearPrefix) {
    const [, year, separator, tail] = yearPrefix
    if (tail.length === 2) {
      return orderDays('').map((day) => `${year}${separator}${tail}${separator}${day}`)
    }
    return orderMonthNumbers(tail).map((month) => `${year}${separator}${month}`)
  }

  const dayPrefix = form.match(/^(\d{1,2})([-/])(\d*)$/)
  if (dayPrefix) {
    const [, head, separator, tail] = dayPrefix
    return orderDays(tail).map((day) => `${head}${separator}${day}`)
  }

  if (/^\d{1,2} de$/.test(form)) {
    const [day] = form.split(' ')
    return orderMonths('').map((month) => `${day} de ${month}`)
  }

  const withYearParticle = form.match(/^(\d{1,2}) (de )?(\p{L}+) de\s*(\d*)$/u)
  if (withYearParticle) {
    const [, day, separator, month, year] = withYearParticle
    if (!isCompleteMonth(month) && orderMonths(month).length === 0) return []
    return yearForms(`${day} ${separator ?? ''}${month}`, year, ' de ')
  }

  const bareYear = form.match(/^(\d{1,2}) (de )?(\p{L}+) (\d+)$/u)
  if (bareYear) {
    const [, day, separator, month, year] = bareYear
    if (!isCompleteMonth(month) && orderMonths(month).length === 0) return []
    return yearForms(`${day} ${separator ?? ''}${month}`, year, ' ')
  }

  const withMonth = form.match(/^(\d{1,2}) (de )?(\p{L}+)$/u)
  if (withMonth) {
    const [, day, separator, month] = withMonth
    const prefix = `${day} ${separator ?? ''}`
    if (isCompleteMonth(month)) {
      return yearForms(`${prefix}${month}`, '', separator ? ' de ' : ' ')
    }
    return orderMonths(month).map((name) => `${prefix}${name}`)
  }

  return []
}

export function dateCompletions(form: string): string[] {
  const needle = normalize(form)
  if (needle === '') return ALL_FORMS.slice(0, SUGGESTION_LIMIT)
  if (isStandaloneKeywordPrefix(needle)) return []
  return [
    ...numericCompletions(needle),
    ...NAMED_FORMS.filter((name) => name.startsWith(needle)),
  ].slice(0, SUGGESTION_LIMIT)
}

function normalize(form: string): string {
  return form.trim().toLowerCase().replace(/\s+/g, ' ')
}
