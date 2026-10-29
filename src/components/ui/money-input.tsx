import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { formatPlainCurrency, maskMoneyInput, parseCurrency } from '@/lib/currency'

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
}

export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  const display = value === '' ? '' : formatPlainCurrency(parseCurrency(value))

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={display}
      onChange={(e) => onValueChange(maskMoneyInput(e.target.value))}
    />
  )
}
