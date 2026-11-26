<script lang="ts">
import { type ChartData, Chart as ChartJS, type ChartOptions, type ChartType } from 'chart.js'
import { onMount } from 'svelte'
import './chart-config'

interface Props {
  type: ChartType
  data: ChartData
  options: ChartOptions
}

let { type, data, options }: Props = $props()

let canvas = $state<HTMLCanvasElement | null>(null)
let chart: ChartJS | null = null

onMount(() => {
  if (!canvas) return
  chart = new ChartJS(canvas, { type, data, options })
  return () => {
    chart?.destroy()
    chart = null
  }
})

$effect(() => {
  const current = chart
  if (!current) return
  current.data = data
  current.options = options
  current.update('none')
})
</script>

<div class="relative h-full w-full">
  <canvas bind:this={canvas}></canvas>
</div>
