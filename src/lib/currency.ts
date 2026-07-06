import c from 'currency.js'

const brlOpts = { symbol: 'R$ ', separator: '.', decimal: ',', precision: 2 }

export function parseCurrency(input: string | number): number {
  if (typeof input === 'number') return input
  return c(input, { precision: 2 }).value
}

export function formatCurrency(value: number): string {
  return c(value, brlOpts).format()
}
