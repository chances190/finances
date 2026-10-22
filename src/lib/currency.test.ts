import { describe, expect, test } from 'bun:test'
import {
  addCurrency,
  formatAxisCurrency,
  formatCurrency,
  formatPlainCurrency,
  parseCurrency,
  parseCurrencyStrict,
} from './currency'

describe('parseCurrency', () => {
  test('parses pt-BR decimal and thousands separators', () => {
    expect(parseCurrency('450,50')).toBe(450.5)
    expect(parseCurrency('1.234,56')).toBe(1234.56)
  })

  test('passes through numbers', () => {
    expect(parseCurrency(99.9)).toBe(99.9)
  })

  test('empty input is zero', () => {
    expect(parseCurrency('')).toBe(0)
  })
})

describe('parseCurrencyStrict', () => {
  test('accepts dot decimals and pt-BR amounts', () => {
    expect(parseCurrencyStrict('150.5')).toBe(150.5)
    expect(parseCurrencyStrict('1.234,56')).toBe(1234.56)
    expect(parseCurrencyStrict('1234,56')).toBe(1234.56)
    expect(parseCurrencyStrict('-60.95')).toBe(-60.95)
  })

  test('rejects trailing garbage and empty input', () => {
    expect(parseCurrencyStrict('12x')).toBeNull()
    expect(parseCurrencyStrict('abc')).toBeNull()
    expect(parseCurrencyStrict('')).toBeNull()
  })
})

describe('formatCurrency', () => {
  test('formats as BRL with symbol and thousands separator', () => {
    expect(formatCurrency(1500.5)).toContain('1.500,50')
    expect(formatCurrency(1500.5)).toContain('R$')
  })
})

describe('formatPlainCurrency', () => {
  test('formats without the symbol in BRL style', () => {
    expect(formatPlainCurrency(450.5)).toBe('450,50')
    expect(formatPlainCurrency(1234.56)).toBe('1.234,56')
  })
})

describe('addCurrency', () => {
  test('avoids float drift', () => {
    expect(addCurrency(0.1, 0.2)).toBe(0.3)
  })
})

describe('formatAxisCurrency', () => {
  test('rounds to whole units with a thousands separator', () => {
    expect(formatAxisCurrency(1234)).toContain('1.234')
    expect(formatAxisCurrency(1500.5)).not.toContain(',')
  })
})
