import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  Filler,
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
  Filler,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  PieController,
  Tooltip,
  annotationPlugin,
)

export interface ChartPalette {
  dark: boolean
  border: string
  grid: string
  muted: string
  foreground: string
  popover: string
  surface: string
  series: typeof CHART_COLORS
  categories: string[]
  actualBar: string
}

const SERIES_DARK: typeof CHART_COLORS = {
  income: '#6fd4a0',
  expense: '#f08a8a',
  primary: '#95d6c7',
  warning: '#f3c777',
  suggestion: '#a9c4b4',
  projection: '#7fa9bb',
  balance: '#95d6c7',
  budgeted: '#5c6b73',
  actual: '#95d6c7',
}

const PAYMENT_METHOD_COLORS_DARK: Record<DisplayPaymentMethod, string> = {
  'Debit/PIX': '#7fc6da',
  Credit: '#c79ab9',
  'Voucher Debit': '#d9a4b8',
  Cash: '#9ecdd8',
  Salary: '#d8c98f',
  Transfer: '#95d6c7',
  'Voucher Income': '#d7b28d',
  'Someone else': '#c7b9a0',
}

export function paymentMethodChartColor(
  method: DisplayPaymentMethod,
  palette: ChartPalette,
): string {
  return palette.dark ? PAYMENT_METHOD_COLORS_DARK[method] : PAYMENT_METHOD_COLORS[method]
}

function readVar(style: CSSStyleDeclaration, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback
}

export function chartPalette(): ChartPalette {
  const dark = theme.resolved === 'dark'
  const root = document.querySelector('.lab-stage') ?? document.documentElement
  const style = getComputedStyle(root)
  const read = (name: string, fallback: string) => readVar(style, name, fallback)
  const chart = (index: number, fallback: string) => read(`--chart-${index}`, fallback)
  const series = dark ? SERIES_DARK : CHART_COLORS
  return {
    dark,
    border: read('--border', dark ? 'rgba(255, 255, 255, 0.12)' : '#e5e7eb'),
    grid: read('--chart-grid', dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(30, 60, 60, 0.08)'),
    muted: read('--muted-foreground', dark ? '#b6c8c1' : '#5f6d68'),
    foreground: read('--foreground', dark ? '#eceef2' : '#111827'),
    popover: read('--popover', dark ? '#1c2724' : '#ffffff'),
    surface: read('--card', dark ? '#1c2724' : '#ffffff'),
    series: {
      income: read('--chart-income', series.income),
      expense: read('--chart-expense', series.expense),
      primary: chart(1, series.primary),
      warning: chart(3, series.warning),
      suggestion: chart(3, series.suggestion),
      projection: chart(4, series.projection),
      balance: chart(1, series.balance),
      budgeted: read('--chart-budgeted', series.budgeted),
      actual: chart(1, series.actual),
    },
    categories: [
      chart(1, CATEGORY_COLORS[0]),
      chart(2, CATEGORY_COLORS[1]),
      chart(3, CATEGORY_COLORS[2]),
      chart(4, CATEGORY_COLORS[3]),
      chart(5, CATEGORY_COLORS[4]),
      chart(6, CATEGORY_COLORS[5]),
    ],
    actualBar: chart(1, dark ? SERIES_DARK.actual : CHART_COLORS.actual),
  }
}

function baseOptions(palette: ChartPalette): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 6, bottom: 2, left: 2 } },
    animation: { duration: 320, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: palette.popover,
        borderColor: palette.border,
        borderWidth: 1,
        titleColor: palette.foreground,
        bodyColor: palette.foreground,
        padding: 10,
        cornerRadius: 8,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { size: 11, weight: 600 },
        bodyFont: { size: 11 },
        callbacks: {
          label: (context) => {
            const parsed = context.parsed as number | { y?: number; x?: number }
            const value = typeof parsed === 'number' ? parsed : (parsed.y ?? parsed.x ?? 0)
            return `${context.dataset.label ?? ''}: ${formatCurrency(value)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 11, weight: 500 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        beginAtZero: true,
        min: 0,
        grid: { color: palette.grid, drawTicks: false },
        border: { display: false },
        ticks: {
          color: palette.muted,
          font: { size: 11, weight: 500 },
          maxTicksLimit: 5,
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
            borderDash: [2, 3],
            borderWidth: 1,
            label: {
              content: 'Today',
              position: 'end',
              yAdjust: 4,
              font: { size: 9, weight: 600 },
              color: palette.muted,
            },
          },
        },
      },
    },
  }
}

function monthLabel(value: string): string {
  return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GB', {
    month: 'short',
  })
}

function barDataset(label: string, data: number[], color: string) {
  return {
    type: 'bar' as const,
    label,
    data,
    backgroundColor: color,
    borderWidth: 0,
    borderRadius: 3,
    borderSkipped: false,
    maxBarThickness: 28,
    categoryPercentage: 0.72,
    barPercentage: 0.78,
  }
}

function lineDataset(label: string, data: (number | null)[], color: string, dashed = false) {
  return {
    type: 'line' as const,
    label,
    data,
    borderColor: color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: dashed ? [4, 5] : undefined,
    pointRadius: 0,
    pointHoverRadius: 3,
    pointHitRadius: 12,
    tension: 0.35,
    spanGaps: true,
  }
}

export function buildPaceChart(
  data: SpendingPaceResult['daily'],
  currentDay: number,
  palette: ChartPalette,
  mode: 'daily' | 'cumulative',
): { data: ChartData; options: ChartOptions } {
  const labels = data.map((entry) => String(entry.day))
  const datasets =
    mode === 'daily'
      ? [
          barDataset(
            'Actual',
            data.map((entry) => entry.actual),
            palette.series.actual,
          ),
          lineDataset(
            'Daily quota',
            data.map((entry) => entry.reference),
            palette.series.primary,
            true,
          ),
          lineDataset(
            'Trend',
            data.map((entry) => entry.trend),
            palette.series.projection,
          ),
        ]
      : [
          {
            ...lineDataset(
              'Actual',
              data.map((entry) => entry.actual),
              palette.series.actual,
            ),
            fill: true,
            backgroundColor: palette.dark
              ? 'rgba(149, 214, 199, 0.10)'
              : 'rgba(47, 111, 104, 0.08)',
          },
          lineDataset(
            'Daily quota',
            data.map((entry) => entry.reference),
            palette.series.primary,
            true,
          ),
          lineDataset(
            'Projection',
            data.map((entry) => entry.trend),
            palette.series.projection,
          ),
        ]

  return {
    data: { labels, datasets },
    options: withAnnotation(baseOptions(palette), currentDay, palette),
  }
}

export function buildBudgetChart(
  data: { category: string; budgeted: number; actual: number }[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  const options = baseOptions(palette)
  return {
    data: {
      labels: data.map((entry) => entry.category),
      datasets: [
        barDataset(
          'Budgeted',
          data.map((entry) => entry.budgeted),
          palette.series.budgeted,
        ),
        barDataset(
          'Actual',
          data.map((entry) => entry.actual),
          palette.series.actual,
        ),
      ],
    },
    options: {
      ...options,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          min: 0,
          grid: { color: palette.grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: palette.muted,
            font: { size: 11, weight: 500 },
            maxTicksLimit: 5,
            callback: (value) => formatAxisCurrency(Number(value)),
          },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: palette.foreground, font: { size: 11, weight: 500 } },
        },
      },
    },
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
          borderColor: palette.surface,
          borderWidth: 2,
          hoverOffset: 3,
        },
      ],
    },
    options: {
      ...(options as ChartOptions<'doughnut'>),
      cutout: '64%',
      scales: {},
      plugins: {
        ...options.plugins,
        tooltip: {
          ...options.plugins?.tooltip,
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(Number(context.parsed))}`,
          },
        },
      },
    } as ChartOptions,
  }
}

export function buildMonthlyChart(
  data: { referenceMonth: string; income: number; expenses: number }[],
  palette: ChartPalette,
): { data: ChartData; options: ChartOptions } {
  return {
    data: {
      labels: data.map((entry) => monthLabel(entry.referenceMonth)),
      datasets: [
        barDataset(
          'Income',
          data.map((entry) => entry.income),
          palette.series.income,
        ),
        barDataset(
          'Spending',
          data.map((entry) => entry.expenses),
          palette.series.expense,
        ),
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
      labels: data.map((entry) => monthLabel(entry.month)),
      datasets: categories.map((category, index) =>
        lineDataset(
          category,
          data.map((entry) => Number(entry[category] ?? 0)),
          palette.categories[index % palette.categories.length],
        ),
      ),
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
      labels: data.map((entry) => monthLabel(entry.referenceMonth)),
      datasets: [
        barDataset(
          'Total',
          data.map((entry) => entry.total),
          palette.series.actual,
        ),
      ],
    },
    options:
      max > 0
        ? { ...options, scales: { ...options.scales, y: { ...options.scales?.y, max } } }
        : options,
  }
}
