import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { dateCompletions, parsePortugueseDate } from './dates'

const ORIGINAL_DATE = Date

function mockToday(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  const fake = new ORIGINAL_DATE(y, m - 1, d, 12, 0, 0)
  globalThis.Date = class extends ORIGINAL_DATE {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fake.getTime())
      } else {
        // @ts-expect-error spread
        super(...args)
      }
    }
    static now() {
      return fake.getTime()
    }
  } as typeof Date
}

beforeEach(() => mockToday('2026-09-16'))
afterEach(() => {
  globalThis.Date = ORIGINAL_DATE
})

describe('explicit relative keywords', () => {
  test('hoje', () => expect(parsePortugueseDate('hoje')).toBe('2026-09-16'))
  test('ontem', () => expect(parsePortugueseDate('ontem')).toBe('2026-09-15'))
  test('anteontem', () => expect(parsePortugueseDate('anteontem')).toBe('2026-09-14'))
  test('amanhã', () => expect(parsePortugueseDate('amanhã')).toBe('2026-09-17'))
  test('amanha without accent', () => expect(parsePortugueseDate('amanha')).toBe('2026-09-17'))
  test('depois de amanhã', () => expect(parsePortugueseDate('depois de amanhã')).toBe('2026-09-18'))
  test('depois de amanha without accent', () =>
    expect(parsePortugueseDate('depois de amanha')).toBe('2026-09-18'))
})

describe('weekdays', () => {
  test('bare weekday is its most recent occurrence', () => {
    expect(parsePortugueseDate('segunda')).toBe('2026-09-14')
    expect(parsePortugueseDate('terça-feira')).toBe('2026-09-15')
    expect(parsePortugueseDate('quarta')).toBe('2026-09-16')
  })

  test('unaccented weekday', () => {
    expect(parsePortugueseDate('terca')).toBe('2026-09-15')
    expect(parsePortugueseDate('sabado')).toBe('2026-09-12')
  })

  test('suffix variants', () => {
    expect(parsePortugueseDate('segunda passada')).toBe('2026-09-07')
    expect(parsePortugueseDate('segunda atrasada')).toBe('2026-08-31')
    expect(parsePortugueseDate('segunda retrasada')).toBe('2026-08-31')
    expect(parsePortugueseDate('sexta que vem')).toBe('2026-09-25')
  })

  test('prefix variants', () => {
    expect(parsePortugueseDate('próxima segunda')).toBe('2026-09-21')
    expect(parsePortugueseDate('proxima segunda')).toBe('2026-09-21')
    expect(parsePortugueseDate('última segunda')).toBe('2026-09-07')
    expect(parsePortugueseDate('esta quarta')).toBe('2026-09-16')
  })
})

describe('calendar dates', () => {
  test('absolute joined month form', () => {
    expect(parsePortugueseDate('12 de junho de 2025')).toBe('2025-06-12')
  })

  test('joined month form without a year uses the current year', () => {
    expect(parsePortugueseDate('25 de dezembro')).toBe('2026-12-25')
    expect(parsePortugueseDate('12 de junho')).toBe('2026-06-12')
  })

  test('month name without the "de" particle', () => {
    expect(parsePortugueseDate('12 junho')).toBe('2026-06-12')
    expect(parsePortugueseDate('12 junho de 2025')).toBe('2025-06-12')
    expect(parsePortugueseDate('12 junho 2025')).toBe('2025-06-12')
    expect(parsePortugueseDate('12 de junho 2025')).toBe('2025-06-12')
  })

  test('abbreviated natural date', () => {
    expect(parsePortugueseDate('12 jun')).toBe('2026-06-12')
    expect(parsePortugueseDate('12 jun.')).toBe('2026-06-12')
  })

  test('iso and short date', () => {
    expect(parsePortugueseDate('2026-09-16')).toBe('2026-09-16')
    expect(parsePortugueseDate('12/09')).toBe('2026-09-12')
    expect(parsePortugueseDate('12/09/25')).toBe('2025-09-12')
    expect(parsePortugueseDate('12/09/2025')).toBe('2025-09-12')
  })
})

describe('completions', () => {
  test('offers full month names without the "de" particle', () => {
    expect(dateCompletions('12 ju')).toContain('12 junho')
    expect(dateCompletions('12 ju')).toContain('12 julho')
  })

  test('offers full month names after "de"', () => {
    expect(dateCompletions('12 de ju')).toContain('12 de junho')
    expect(dateCompletions('12 de ju')).toContain('12 de julho')
  })

  test('a complete month name extends to years starting at the current year', () => {
    expect(dateCompletions('12 junho')[0]).toBe('12 junho 2026')
    expect(dateCompletions('12 de junho')[0]).toBe('12 de junho de 2026')
  })

  test('the "de" before the year is optional and preserved', () => {
    expect(dateCompletions('12 junho 20')).toContain('12 junho 2026')
    expect(dateCompletions('12 junho de 20')).toContain('12 junho de 2026')
    expect(dateCompletions('12 de junho 20')).toContain('12 de junho 2026')
  })
})

describe('rejections', () => {
  test('unknown month name', () => expect(parsePortugueseDate('12 de xyz')).toBeNull())
  test('unknown weekday', () => expect(parsePortugueseDate('xyzday passada')).toBeNull())
  test('unrelated word', () => expect(parsePortugueseDate('almoço')).toBeNull())
  test('bare number', () => expect(parsePortugueseDate('12')).toBeNull())
})
