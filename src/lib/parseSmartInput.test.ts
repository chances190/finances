import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { acceptSuggestion, getSuggestions, parseSmartInput } from './parseSmartInput'

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

const CATS = ['Food', 'Transport', 'Housing']
const KNOWN = ['Almoço', 'Aluguel', 'Uber']

const parse = (text: string) => parseSmartInput(text, CATS)

describe('§2.1 amount', () => {
  test('comma decimals', () => {
    expect(parse('2,50 almoço').amount).toBe(2.5)
  })

  test('a four-digit amount after a date is not mistaken for a year', () => {
    const result = parse('almoço 25 jun 1000,00')
    expect(result.amount).toBe(1000)
    expect(result.date).toBe('2026-06-25')
    expect(result.description).toBe('almoço')
  })

  test('R$ with space and thousands separator', () => {
    expect(parse('R$ 1.200,00 almoço').amount).toBe(1200)
  })

  test('R$ without space', () => {
    expect(parse('R$1200,00 almoço').amount).toBe(1200)
  })

  test('bare integers are free text', () => {
    const result = parse('2 almoço 23,50')
    expect(result.amount).toBe(23.5)
    expect(result.description).toBe('2 almoço')
  })

  test('bare integer alone is not an amount', () => {
    const result = parse('Almoço 12')
    expect(result.amount).toBeNull()
    expect(result.error).toBe('Amount required')
  })

  test('R$ without decimals is not an amount', () => {
    const result = parse('Almoço R$ 23')
    expect(result.amount).toBeNull()
    expect(result.error).toBe('Amount required')
  })

  test('dot decimals are not pt-BR amounts', () => {
    const result = parse('Almoço 23.50')
    expect(result.amount).toBeNull()
    expect(result.error).toBe('Amount required')
  })

  test('multiple amounts', () => {
    expect(parse('23,50 Almoço 12,90 extra').error).toBe('Multiple amounts')
  })
})

describe('§2.2 date', () => {
  test('standalone keywords', () => {
    expect(parse('almoço 2,50 hoje').date).toBe('2026-09-16')
    expect(parse('almoço 2,50 ontem').date).toBe('2026-09-15')
    expect(parse('almoço 2,50 anteontem').date).toBe('2026-09-14')
    expect(parse('almoço 2,50 amanhã').date).toBe('2026-09-17')
    expect(parse('almoço 2,50 depois de amanhã').date).toBe('2026-09-18')
  })

  test('bare weekday resolves to its most recent occurrence', () => {
    expect(parse('almoço 2,50 segunda').date).toBe('2026-09-14')
    expect(parse('almoço 2,50 quarta').date).toBe('2026-09-16')
    expect(parse('almoço 2,50 terça-feira').date).toBe('2026-09-15')
  })

  test('weekday modifiers', () => {
    expect(parse('almoço 2,50 segunda passada').date).toBe('2026-09-07')
    expect(parse('almoço 2,50 segunda atrasada').date).toBe('2026-08-31')
    expect(parse('almoço 2,50 segunda retrasada').date).toBe('2026-08-31')
    expect(parse('almoço 2,50 próxima segunda').date).toBe('2026-09-21')
    expect(parse('almoço 2,50 sexta que vem').date).toBe('2026-09-25')
    expect(parse('almoço 2,50 esta quarta').date).toBe('2026-09-16')
    expect(parse('almoço 2,50 última segunda').date).toBe('2026-09-07')
  })

  test('joined portuguese month form', () => {
    expect(parse('almoço 2,50 12 de junho de 2025').date).toBe('2025-06-12')
    expect(parse('almoço 2,50 25 de dezembro').date).toBe('2026-12-25')
    expect(parse('almoço 2,50 12 de junho').date).toBe('2026-06-12')
    expect(parse('almoço 2,50 12 junho').date).toBe('2026-06-12')
    expect(parse('almoço 2,50 12 jun').date).toBe('2026-06-12')
  })

  test('iso and short date', () => {
    expect(parse('almoço 2,50 2026-09-16').date).toBe('2026-09-16')
    expect(parse('almoço 2,50 12/09').date).toBe('2026-09-12')
  })

  test('unresolvable month stays free text', () => {
    const result = parse('12 de xyz almoço 2,50')
    expect(result.date).toBeNull()
    expect(result.description).toBe('12 de xyz almoço')
  })

  test('multiple dates', () => {
    expect(parse('23,50 Almoço ontem amanhã').error).toBe('Multiple dates')
  })
})

describe('§2.3 category', () => {
  test('resolves against the registry', () => {
    expect(parse('23,50 Almoço #Food').category).toBe('Food')
  })

  test('unresolved token is free text', () => {
    const result = parse('23,50 Almoço #Nope')
    expect(result.category).toBeNull()
    expect(result.description).toBe('Almoço #Nope')
  })

  test('multiple categories', () => {
    expect(parse('23,50 Almoço #Food #Transport').error).toBe('Multiple categories')
  })
})

describe('§2.4 payment method', () => {
  test('resolves against the registry', () => {
    const result = parse('23,50 Almoço @Debit/PIX')
    expect(result.paymentMethod).toBe('Debit/PIX')
    expect(result.kind).toBe('expense')
  })

  test('bare debit alias resolves to Debit/PIX', () => {
    const result = parse('23,50 Almoço @Debit hoje')
    expect(result.paymentMethod).toBe('Debit/PIX')
    expect(result.description).toBe('Almoço')
  })

  test('voucher resolves by direction', () => {
    const income = parse('23,50 Almoço @Voucher')
    expect(income.paymentMethod).toBe('Voucher Income')
    expect(income.kind).toBe('income')

    const expense = parse('23,50 Almoço @Voucher Debit')
    expect(expense.paymentMethod).toBe('Voucher Debit')
    expect(expense.kind).toBe('expense')
  })

  test('multi-word payment method is a single span', () => {
    const result = parse('23,50 Almoço @Voucher Debit')
    expect(result.paymentMethod).toBe('Voucher Debit')
    expect(result.description).toBe('Almoço')
  })

  test('unresolved token is free text', () => {
    const result = parse('23,50 Almoço @xyz')
    expect(result.paymentMethod).toBeNull()
    expect(result.description).toBe('Almoço @xyz')
  })

  test('multiple payment methods', () => {
    expect(parse('23,50 Almoço @Debit/PIX @Credit').error).toBe('Multiple payment methods')
  })
})

describe('§2.5 description', () => {
  test('contiguous free text', () => {
    expect(parse('Almoço 2 pessoas 23,50').description).toBe('Almoço 2 pessoas')
  })

  test('a committed span splitting free text is invalid', () => {
    expect(parse('Almoço 23,50 Aluguel').error).toBe('Description must be contiguous')
  })

  test('a category splitting free text is invalid', () => {
    expect(parse('Almoço #Food Aluguel 23,50').error).toBe('Description must be contiguous')
  })

  test('missing description', () => {
    expect(parse('23,50 #Food').error).toBe('Description required')
  })

  test('missing amount', () => {
    expect(parse('Almoço').error).toBe('Amount required')
  })
})

describe('§3 span commitment', () => {
  test('provisional weekday commits when the description survives', () => {
    const result = parse('desc seg 2,00')
    expect(result.date).toBe('2026-09-14')
    expect(result.description).toBe('desc')
  })

  test('provisional weekday is demoted when it would split the description', () => {
    const result = parse('desc seg moredesc 2,00')
    expect(result.date).toBeNull()
    expect(result.description).toBe('desc seg moredesc')
    expect(result.error).toBeNull()
  })

  test('standalone keyword commits before the description', () => {
    const result = parse('hoje almoço 2,00')
    expect(result.date).toBe('2026-09-16')
    expect(result.description).toBe('almoço')
  })

  test('standalone keyword between free text is demoted', () => {
    const result = parse('almoço hoje bar 2,00')
    expect(result.date).toBeNull()
    expect(result.description).toBe('almoço hoje bar')
    expect(result.error).toBeNull()
  })

  test('standalone keyword with no other free text is demoted', () => {
    const result = parse('hoje 2,00')
    expect(result.date).toBeNull()
    expect(result.description).toBe('hoje')
    expect(result.error).toBeNull()
  })

  test('multi-word date forms commit unconditionally', () => {
    const result = parse('almoço próxima segunda bar 2,00')
    expect(result.date).toBe('2026-09-21')
    expect(result.error).toBe('Description must be contiguous')
  })
})

describe('§3 order independence', () => {
  test('same result regardless of order', () => {
    const a = parse('23,50 Almoço #Food @Debit/PIX ontem')
    const b = parse('#Food @Debit/PIX ontem 23,50 Almoço')
    expect(b).toEqual(a)
  })
})

describe('§4 autocomplete', () => {
  const suggestions = (text: string) => getSuggestions(text, KNOWN, CATS)

  test('day number followed by de is date-in-progress', () => {
    expect(suggestions('12 de')).toContain('12 de setembro')
  })

  test('day number followed by a slash is date-in-progress', () => {
    expect(suggestions('12/')).toContain('12/09')
  })

  test('year part is date-in-progress', () => {
    expect(suggestions('12 de junho de')).toContain('12 de junho de 2026')
  })

  test('broken month returns to free-form', () => {
    expect(suggestions('12 de xyz')).toEqual([])
  })

  test('letters after a slash return to free-form', () => {
    expect(suggestions('12/ab')).toEqual([])
  })

  test('weekday prefixes are date-in-progress', () => {
    expect(suggestions('seg')).toContain('segunda')
    expect(suggestions('próxima')).toContain('próxima segunda')
    expect(suggestions('próxima seg')).toContain('próxima segunda')
  })

  test('broken weekday returns to free-form', () => {
    expect(suggestions('seg x')).toEqual([])
  })

  test('standalone keyword and its prefixes stay free-form', () => {
    expect(suggestions('ho')).toEqual([])
    expect(suggestions('hoje')).toEqual([])
    expect(suggestions('ontem')).toEqual([])
  })

  test('closed description with no date suggests dates', () => {
    expect(suggestions('Almoço 12,50 ')).toContain('hoje')
  })

  test('a committed date closes the date slot', () => {
    expect(suggestions('Almoço 12,50 hoje ')).toEqual([])
  })

  test('category prefix', () => {
    expect(suggestions('#Fo')).toEqual(['#Food'])
  })

  test('filled category slot yields nothing', () => {
    expect(suggestions('#Food #Fo')).toEqual([])
  })

  test('payment prefix', () => {
    expect(suggestions('Almoço @D')).toEqual(['@Debit/PIX'])
  })

  test('filled payment slot yields nothing', () => {
    expect(suggestions('Almoço @Debit/PIX @d')).toEqual([])
  })

  test('ambiguous voucher offers both kinds', () => {
    expect(suggestions('Almoço @Vou')).toEqual(['@Voucher Debit', '@Voucher Income'])
  })

  test('open description suggests historical descriptions', () => {
    expect(suggestions('Al')).toEqual(['Almoço', 'Aluguel'])
  })

  test('amounts are never suggested as free text', () => {
    expect(suggestions('Almoço R$ 23')).toEqual([])
  })
})

describe('acceptSuggestion', () => {
  test('replaces the trailing word', () => {
    expect(acceptSuggestion('Almoço #Fo', '#Food')).toBe('Almoço #Food ')
  })

  test('appends after a trailing space', () => {
    expect(acceptSuggestion('Almoço ', '@Debit/PIX')).toBe('Almoço @Debit/PIX ')
  })

  test('replaces the whole trailing token', () => {
    expect(acceptSuggestion('Al', 'Almoço')).toBe('Almoço ')
  })

  test('replaces a multi-word date form', () => {
    expect(acceptSuggestion('Almoço 12,50 12 de', '12 de junho')).toBe('Almoço 12,50 12 de junho ')
  })

  test('appends a date after a closed description', () => {
    expect(acceptSuggestion('Almoço 12,50 ', 'hoje')).toBe('Almoço 12,50 hoje ')
  })
})
