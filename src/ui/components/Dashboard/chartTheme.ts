import type { CSSProperties } from 'react'
import { formatAxisCurrency, formatCurrency } from '@/lib/currency'

export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  color: 'var(--foreground)',
  borderRadius: '8px',
  fontSize: '12px',
}

export const CHART_LEGEND_STYLE: CSSProperties = {
  fontSize: '10px',
  color: 'var(--foreground)',
}

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
}

export const TODAY_LABEL = {
  value: 'Today',
  position: 'insideTopRight' as const,
  fontSize: 10,
  fill: 'var(--muted-foreground)',
}

export const formatChartCurrency = (value: number | string) => formatCurrency(Number(value))

export const formatChartAxis = (value: number) => formatAxisCurrency(value)

export const formatMonthTick = (value: string) => value.slice(5)
