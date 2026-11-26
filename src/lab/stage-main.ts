import { mount } from 'svelte'
import '@/index.css'
import './lab.css'
import { setFinancePersistence } from '@/lib/stores/finance.svelte'
import LabStageApp from './LabStageApp.svelte'

if (!import.meta.env.DEV) throw new Error('The design lab is dev-only')

setFinancePersistence(false)

type PushArgs = Parameters<History['pushState']>
const pushState = history.pushState.bind(history)
const replaceState = history.replaceState.bind(history)
const staysInStage = (url: string | URL | null | undefined) =>
  !url || new URL(String(url), location.href).pathname === location.pathname
history.pushState = (...args: PushArgs) => {
  if (staysInStage(args[2])) pushState(...args)
}
history.replaceState = (...args: PushArgs) => {
  if (staysInStage(args[2])) replaceState(...args)
}

const target = document.getElementById('stage')
if (!target) throw new Error('Lab stage root not found')

mount(LabStageApp, { target })
