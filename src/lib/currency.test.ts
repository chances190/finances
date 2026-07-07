import { describe, expect, test } from 'bun:test'
import { formatCurrency, parseCurrency } from './currency'

describe('parseCurrency', () => {
  test('parses string number', () => {
    expect(parseCurrency('1500.50')).toBe(1500.5)
  })
  test('passes through number', () => {
    expect(parseCurrency(99.9)).toBe(99.9)
  })
  test('handles zero', () => {
    expect(parseCurrency('0')).toBe(0)
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
