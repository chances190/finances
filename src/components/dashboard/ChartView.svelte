<script lang="ts">
import type { ChartData, ChartOptions, ChartType } from 'chart.js'
import { Chart } from 'svelte-chartjs'

interface Props {
  type: ChartType
  data: ChartData
  options: ChartOptions
}

let { type, data, options }: Props = $props()
</script>

<div class="relative h-full w-full">
  <Chart {type} {data} {options} />
</div>
