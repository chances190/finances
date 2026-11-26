<script lang="ts">
import { onMount } from 'svelte'
import LabToolbar from './LabToolbar.svelte'
import { defaultSettings, type LabScreen, type LabSettings } from './types'

let settings = $state<LabSettings>({ ...defaultSettings })
let frame = $state<HTMLIFrameElement | null>(null)
let ready = $state(false)

const screens = new Set<LabScreen>([
  'transactions',
  'budgets',
  'debts',
  'dashboard',
  'trends',
  'actions',
])

function sendSettings() {
  frame?.contentWindow?.postMessage({ type: 'lab-settings', settings: { ...settings } }, '*')
}

$effect(() => {
  if (!ready) return
  sendSettings()
})

onMount(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'lab-ready') {
      ready = true
      sendSettings()
      return
    }
    if (event.data?.type === 'lab-screen' && screens.has(event.data.screen)) {
      settings.screen = event.data.screen
    }
  }
  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
})

function reset() {
  Object.assign(settings, defaultSettings)
}
</script>

<LabToolbar bind:settings onReset={reset} />

<div class="lab-stage-wrap">
  <div class="lab-stage-frame" style="width: {settings.viewport}px">
    <iframe
      bind:this={frame}
      src="/lab-stage.html"
      title="Design lab app preview"
      onload={() => {
        ready = true
        sendSettings()
      }}
    ></iframe>
  </div>
</div>
