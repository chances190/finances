import { describe, expect, test } from 'bun:test'
import { formatCurrency, formatPlainCurrency, parseCurrency } from './currency'

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
