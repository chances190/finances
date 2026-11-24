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
import { formatAxisCurrency, formatCurrency } from '@/lib/currency'

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
  border: string
  muted: string
  foreground: string
  popover: string
}

export function chartPalette(): ChartPalette {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    border: read('--border', '#e5e7eb'),
    muted: read('--muted-foreground', '#6b7280'),
    foreground: read('--foreground', '#111827'),
    popover: read('--popover', '#ffffff'),
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
          backgroundColor: 'rgba(59, 130, 246, 0.45)',
          borderWidth: 0,
        },
        {
          type: 'line',
          label: 'Daily quota',
          data: data.map((entry) => entry.reference),
          borderColor: CHART_COLORS.primary,
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
        },
        {
          type: 'line',
          label: 'Trend',
          data: data.map((entry) => entry.trend),
          borderColor: CHART_COLORS.projection,
          borderWidth: 1.5,
          borderDash: [5, 3],
          pointRadius: 0,
          spanGaps: true,
        },
        {
          type: 'line',
          label: 'Suggestion',
          data: data.map((entry) => entry.suggestion),
          borderColor: CHART_COLORS.suggestion,
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
          backgroundColor: CHART_COLORS.budgeted,
          borderRadius: [2, 2, 0, 0],
        },
        {
          type: 'bar',
          label: 'Actual',
          data: data.map((entry) => entry.actual),
          backgroundColor: CHART_COLORS.actual,
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
          backgroundColor: CHART_COLORS.income,
          borderRadius: [2, 2, 0, 0],
        },
        {
          type: 'bar',
          label: 'Spending',
          data: data.map((entry) => entry.expenses),
          backgroundColor: CHART_COLORS.expense,
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
        borderColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
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
          backgroundColor: CHART_COLORS.expense,
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
