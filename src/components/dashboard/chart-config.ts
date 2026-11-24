import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import type { FutureCommitment, SpendingPaceResult } from '@/domain/calculations'
import { CATEGORY_COLORS, CHART_COLORS } from '@/domain/constants'
import { type DisplayPaymentMethod, PAYMENT_METHOD_COLORS } from '@/domain/ledger'
import { formatAxisCurrency, formatCurrency } from '@/lib/currency'
import { theme } from '@/lib/stores/theme.svelte'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  PieController,
  Tooltip,
  Legend,
  annotationPlugin,
)

export interface ChartPalette {
  dark: boolean
  border: string
  muted: string
  foreground: string
  popover: string
  series: typeof CHART_COLORS
  categories: string[]
  actualBar: string
}

const SERIES_DARK: typeof CHART_COLORS = {
  income: '#4ade80',
  expense: '#f87171',
  primary: '#60a5fa',
  warning: '#fbbf24',
  suggestion: '#a78bfa',
  projection: '#fb923c',
  balance: '#60a5fa',
  budgeted: '#60a5fa',
  actual: '#fbbf24',
}

const CATEGORY_COLORS_DARK = [
  '#60a5fa',
  '#4ade80',
  '#fbbf24',
  '#c084fc',
  '#f87171',
  '#22d3ee',
  '#f472b6',
  '#2dd4bf',
  '#fb923c',
  '#818cf8',
  '#a3e635',
  '#e879f9',
]

const PAYMENT_METHOD_COLORS_DARK: Record<DisplayPaymentMethod, string> = {
  'Debit/PIX': '#2dd4bf',
  Credit: '#c084fc',
  'Voucher Debit': '#f472b6',
  Cash: '#34d399',
  Salary: '#facc15',
  Transfer: '#38bdf8',
  'Voucher Income': '#fb923c',
  'Someone else': '#fbbf24',
}

export function paymentMethodChartColor(
  method: DisplayPaymentMethod,
  palette: ChartPalette,
): string {
  return palette.dark ? PAYMENT_METHOD_COLORS_DARK[method] : PAYMENT_METHOD_COLORS[method]
}

export function chartPalette(): ChartPalette {
  const dark = theme.resolved === 'dark'
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    dark,
    border: read('--border', dark ? 'rgba(255, 255, 255, 0.14)' : '#e5e7eb'),
    muted: read('--muted-foreground', dark ? '#b6bdc9' : '#6b7280'),
    foreground: read('--foreground', dark ? '#eceef2' : '#111827'),
    popover: read('--popover', dark ? '#343943' : '#ffffff'),
    series: dark ? SERIES_DARK : CHART_COLORS,
    categories: dark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS,
    actualBar: dark ? 'rgba(96, 165, 250, 0.38)' : 'rgba(59, 130, 246, 0.45)',
  }
}

function baseOptions(palette: ChartPalette): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: palette.foreground,
          font: { size: 10 },
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        backgroundColor: palette.popover,
        borderColor: palette.border,
        borderWidth: 1,
        titleColor: palette.foreground,
        bodyColor: palette.foreground,
        padding: 8,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const parsed = context.parsed as number | { y?: number }
            const value = typeof parsed === 'number' ? parsed : (parsed.y ?? 0)
            return `${context.dataset.label ?? ''}: ${formatCurrency(value)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: palette.muted, font: { size: 11 } },
      },
      y: {
        grid: { color: palette.border, drawTicks: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 11 },
          callback: (value) => formatAxisCurrency(Number(value)),
        },
      },
    },
  }
}

function withAnnotation(
  options: ChartOptions,
  currentDay: number,
  palette: ChartPalette,
): ChartOptions {
  return {
    ...options,
    plugins: {
      ...options.plugins,
      annotation: {
        annotations: {
          today: {
            type: 'line',
            xMin: String(currentDay),
            xMax: String(currentDay),
            borderColor: palette.muted,
            borderDash: [2, 2],
            label: {
              content: 'Today',
              position: 'end',
              yAdjust: 4,
              font: { size: 10 },
              color: palette.muted,
            },
          },
        },
      },
    },
  }
}

export function buildPaceChart(
  data: SpendingPaceResult['daily'],
  currentDay: number,
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  return {
    data: {
      labels: data.map((entry) => String(entry.day)),
      datasets: [
        {
          type: 'bar',
          label: 'Actual',
          data: data.map((entry) => entry.actual),
          backgroundColor: palette.actualBar,
          borderWidth: 0,
        },
        {
          type: 'line',
          label: 'Daily quota',
          data: data.map((entry) => entry.reference),
          borderColor: palette.series.primary,
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
        },
        {
          type: 'line',
          label: 'Trend',
          data: data.map((entry) => entry.trend),
          borderColor: palette.series.projection,
          borderWidth: 1.5,
          borderDash: [5, 3],
          pointRadius: 0,
          spanGaps: true,
        },
        {
          type: 'line',
          label: 'Suggestion',
          data: data.map((entry) => entry.suggestion),
          borderColor: palette.series.suggestion,
          borderWidth: 1.5,
          borderDash: [2, 3],
          pointRadius: 0,
          spanGaps: true,
        },
      ],
    },
    options: withAnnotation(baseOptions(palette), currentDay, palette),
  }
}

export function buildBudgetChart(
  data: { category: string; budgeted: number; actual: number }[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  return {
    data: {
      labels: data.map((entry) => entry.category),
      datasets: [
        {
          type: 'bar',
          label: 'Budgeted',
          data: data.map((entry) => entry.budgeted),
          backgroundColor: palette.series.budgeted,
          borderRadius: [2, 2, 0, 0],
        },
        {
          type: 'bar',
          label: 'Actual',
          data: data.map((entry) => entry.actual),
          backgroundColor: palette.series.actual,
          borderRadius: [2, 2, 0, 0],
        },
      ],
    },
    options: baseOptions(palette),
  }
}

export function buildPaymentPie(
  data: { name: string; value: number; color: string }[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  const options = baseOptions(palette)
  return {
    data: {
      labels: data.map((entry) => entry.name),
      datasets: [
        {
          data: data.map((entry) => entry.value),
          backgroundColor: data.map((entry) => entry.color),
          borderWidth: 0,
        },
      ],
    },
    options: {
      ...options,
      plugins: {
        ...options.plugins,
        legend: { display: false },
        tooltip: {
          ...options.plugins?.tooltip,
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(Number(context.parsed))}`,
          },
        },
      },
    },
  }
}

export function buildMonthlyChart(
  data: { referenceMonth: string; income: number; expenses: number }[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  return {
    data: {
      labels: data.map((entry) => entry.referenceMonth.slice(5)),
      datasets: [
        {
          type: 'bar',
          label: 'Income',
          data: data.map((entry) => entry.income),
          backgroundColor: palette.series.income,
          borderRadius: [2, 2, 0, 0],
        },
        {
          type: 'bar',
          label: 'Spending',
          data: data.map((entry) => entry.expenses),
          backgroundColor: palette.series.expense,
          borderRadius: [2, 2, 0, 0],
        },
      ],
    },
    options: baseOptions(palette),
  }
}

export function buildCategoryTrends(
  data: { month: string; [category: string]: number | string }[],
  categories: string[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  return {
    data: {
      labels: data.map((entry) => entry.month),
      datasets: categories.map((category, index) => ({
        type: 'line',
        label: category,
        data: data.map((entry) => Number(entry[category] ?? 0)),
        borderColor: palette.categories[index % palette.categories.length],
        borderWidth: 2,
        pointRadius: 0,
      })),
    },
    options: baseOptions(palette),
  }
}

export function buildCommitmentsChart(
  data: FutureCommitment[],
  max: number,
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  const options = baseOptions(palette)
  return {
    data: {
      labels: data.map((entry) => entry.referenceMonth),
      datasets: [
        {
          type: 'bar',
          label: 'Total',
          data: data.map((entry) => entry.total),
          backgroundColor: palette.series.expense,
          borderRadius: [2, 2, 0, 0],
        },
      ],
    },
    options:
      max > 0
        ? { ...options, scales: { ...options.scales, y: { ...options.scales?.y, max } } }
        : options,
  }
}
