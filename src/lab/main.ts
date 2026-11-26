import { mount } from 'svelte'
import '@/index.css'
import './lab.css'
import LabApp from './LabApp.svelte'

if (!import.meta.env.DEV) throw new Error('The design lab is dev-only')

const target = document.getElementById('lab')
if (!target) throw new Error('Lab root not found')

mount(LabApp, { target })
