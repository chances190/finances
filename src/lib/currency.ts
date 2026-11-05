import c from 'currency.js'

const brlOpts = { symbol: 'R$ ', separator: '.', decimal: ',', precision: 2 }

export function parseCurrency(input: string | number): number {
  if (typeof input === 'number') return input
  const str = input.trim()
  if (!str) return 0
  if (str.includes(',')) {
    const normalized = Number(str.replace(/\./g, '').replace(/,/g, '.'))
    if (!Number.isNaN(normalized)) return normalized
  }
  return c(str, { precision: 2 }).value
}

const STRICT_CURRENCY = /^(?:R\$\s?)?-?(?:\d+(?:\.\d{3})*,\d{1,2}|\d+(?:\.\d+)?)$/

export function parseCurrencyStrict(input: string): number | null {
  const str = input.trim()
  if (str === '' || !STRICT_CURRENCY.test(str)) return null
  return parseCurrency(str)
}

export function formatCurrency(value: number): string {
  return c(value, brlOpts).format()
}

export function formatPlainCurrency(value: number): string {
  return c(value, { ...brlOpts, symbol: '' }).format()
}

export function maskMoneyInput(raw: string): string {
  const cents = Number(raw.replace(/\D/g, '').slice(0, 15))
  return cents > 0 ? formatPlainCurrency(cents / 100) : ''
}

export function formatAxisCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

export function addCurrency(a: number, b: number): number {
  return c(a).add(b).value
}
