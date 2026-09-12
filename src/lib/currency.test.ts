import { describe, expect, test } from 'bun:test'
import {
  addCurrency,
  formatAxisCurrency,
  formatCurrency,
  formatPlainCurrency,
  parseCurrency,
} from './currency'

describe('parseCurrency', () => {
  test('parses string number', () => {
    expect(parseCurrency('1500.50')).toBe(1500.5)
  })
  test('parses BRL comma decimal', () => {
    expect(parseCurrency('450,50')).toBe(450.5)
  })
  test('parses BRL with thousands separator', () => {
    expect(parseCurrency('1.234,56')).toBe(1234.56)
  })
  test('passes through number', () => {
    expect(parseCurrency(99.9)).toBe(99.9)
  })
  test('handles zero', () => {
    expect(parseCurrency('0')).toBe(0)
  })
  test('handles empty string', () => {
    expect(parseCurrency('')).toBe(0)
  })
})

describe('formatCurrency', () => {
  test('formats as BRL', () => {
    const result = formatCurrency(1500.5)
    expect(result).toContain('R$')
    expect(result).toContain('1.500,50')
  })
  test('handles zero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0,00')
  })
})

describe('formatPlainCurrency', () => {
  test('formats without symbol in BRL style', () => {
    expect(formatPlainCurrency(450.5)).toBe('450,50')
    expect(formatPlainCurrency(1234.56)).toBe('1.234,56')
  })
  test('handles zero', () => {
    expect(formatPlainCurrency(0)).toBe('0,00')
  })
})

describe('addCurrency', () => {
  test('avoids float drift', () => {
    expect(addCurrency(0.1, 0.2)).toBe(0.3)
  })
  test('sums currency values', () => {
    expect(addCurrency(10.5, 20.25)).toBe(30.75)
  })
  test('sums with zero', () => {
    expect(addCurrency(0, 99.99)).toBe(99.99)
  })
})

describe('formatAxisCurrency', () => {
  test('formats compact BRL with thousands separator', () => {
    expect(formatAxisCurrency(1234)).toContain('1.234')
  })
  test('drops cents for axis readability', () => {
    expect(formatAxisCurrency(1500.5)).not.toContain(',')
  })
})
