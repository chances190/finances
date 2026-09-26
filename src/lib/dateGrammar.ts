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
const WEEKDAY_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'sab']
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
const MONTH_NAMES = [...MONTH_FULL, 'marco']
const MONTHS_WITH_ABBR = [...MONTH_NAMES, ...MONTH_ABBR]

const STANDALONE_KEYWORDS = ['hoje', 'ontem', 'anteontem', 'amanhã', 'amanha']
const MULTIWORD_KEYWORDS = ['depois de amanhã', 'depois de amanha']

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
      String.raw`\d{1,2}\s+de\s+${alternation(MONTHS_WITH_ABBR)}(?:\s+de\s+\d{4})?`,
      'iyu',
    ),
    provisional: false,
  },
  {
    re: new RegExp(String.raw`\d{1,2}\s+${alternation(MONTH_ABBR)}\.?`, 'iyu'),
    provisional: false,
  },
  { re: /depois\s+de\s+amanh[ãa]/iuy, provisional: false },
  {
    re: new RegExp(String.raw`pr[oó]xim[ao]s?\s+${alternation(WEEKDAYS)}`, 'iyu'),
    provisional: false,
  },
  {
    re: new RegExp(String.raw`(?:[uú]ltim[ao]s?|esta|esse|essa)\s+${alternation(WEEKDAYS)}`, 'iyu'),
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
      `${day} atrasada`,
      `${day} que vem`,
      `próxima ${day}`,
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

function orderMonths(partial: string): string[] {
  const offset = new Date().getMonth()
  return MONTH_FULL.filter((month) => month.startsWith(partial))
    .map((month) => ({ month, ahead: (MONTH_FULL.indexOf(month) - offset + 12) % 12 }))
    .sort((a, b) => a.ahead - b.ahead)
    .map(({ month }) => month)
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

function yearForms(day: string, month: string, partial: string): string[] {
  const current = new Date().getFullYear()
  const from = partial === '' ? current : 1990
  const out: string[] = []
  for (let year = from; year <= current + 5 && out.length < SUGGESTION_LIMIT; year++) {
    if (String(year).startsWith(partial)) out.push(`${day} de ${month} de ${year}`)
  }
  return out
}

function numericCompletions(form: string): string[] {
  const words = form.split(' ')
  const day = /^\d{1,2}$/.test(words[0]) ? words[0] : null

  if (day !== null && words.length === 5 && words[1] === 'de' && words[3] === 'de') {
    return yearForms(day, words[2], words[4])
  }

  if (day !== null && words.length === 4 && words[1] === 'de' && words[3] === 'de') {
    return MONTH_NAMES.includes(words[2]) ? yearForms(day, words[2], '') : []
  }

  if (day !== null && words.length === 3 && words[1] === 'de') {
    return MONTH_NAMES.includes(words[2])
      ? yearForms(day, words[2], '')
      : orderMonths(words[2]).map((month) => `${day} de ${month}`)
  }

  if (day !== null && words.length === 2 && words[1] === 'de') {
    return orderMonths('').map((month) => `${day} de ${month}`)
  }

  if (day !== null && words.length === 2) {
    return MONTH_ABBR.filter((name) => name.startsWith(words[1])).map((name) => `${day} ${name}`)
  }

  const iso = form.match(/^(\d{4})([-/])(\d{1,2})([-/])(\d*)$/)
  if (iso) {
    const [, year, first, month, second, tail] = iso
    return orderDays(tail).map((value) => `${year}${first}${month}${second}${value}`)
  }

  const yearPrefix = form.match(/^(\d{4})([-/])(\d*)$/)
  if (yearPrefix) {
    const [, year, separator, tail] = yearPrefix
    if (tail.length === 2) {
      return orderDays('').map((value) => `${year}${separator}${tail}${separator}${value}`)
    }
    return orderMonthNumbers(tail).map((month) => `${year}${separator}${month}`)
  }

  const dayPrefix = form.match(/^(\d{1,2})([-/])(\d*)$/)
  if (dayPrefix) {
    const [, head, separator, tail] = dayPrefix
    return orderDays(tail).map((value) => `${head}${separator}${value}`)
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
