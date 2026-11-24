import { loadData, saveData } from '@/data/repository'
import type { AuditEntry, Budget, FinanceData } from '@/domain/entities'
import type { Movement } from '@/domain/ledger'

export interface FinanceState {
  movements: Movement[]
  budgets: Budget[]
  auditLog: AuditEntry[]
  redoStack: AuditEntry[]
  loaded: boolean
}

export type FinanceAction =
  | { type: 'LOAD'; payload: FinanceData }
  | { type: 'ADD_MOVEMENTS'; payload: Movement[] }
  | { type: 'UPDATE_MOVEMENT'; payload: Movement }
  | { type: 'DELETE_MOVEMENT'; payload: string }
  | { type: 'DELETE_MOVEMENTS'; payload: string[] }
  | { type: 'UPSERT_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'IMPORT'; payload: FinanceData }
  | { type: 'APPLY_REMOTE'; payload: FinanceData }
  | { type: 'UNDO'; payload: string }
  | { type: 'REDO' }
  | { type: 'CLEAR_AUDIT' }

function snapshot(state: FinanceState): { movements: Movement[]; budgets: Budget[] } {
  return { movements: state.movements, budgets: state.budgets }
}

function describeAction(action: FinanceAction): string {
  switch (action.type) {
    case 'ADD_MOVEMENTS':
      return `Added ${action.payload.length} transaction${action.payload.length !== 1 ? 's' : ''}`
    case 'UPDATE_MOVEMENT':
      return `Updated transaction "${action.payload.description}"`
    case 'DELETE_MOVEMENT':
      return 'Deleted transaction'
    case 'DELETE_MOVEMENTS':
      return `Deleted ${action.payload.length} transaction${action.payload.length !== 1 ? 's' : ''}`
    case 'UPSERT_BUDGET':
      return `Saved budget for ${action.payload.referenceMonth}`
    case 'DELETE_BUDGET':
      return `Deleted budget for ${action.payload}`
    case 'IMPORT':
      return `Imported ${action.payload.movements.length} transaction${action.payload.movements.length !== 1 ? 's' : ''}`
    case 'UNDO':
      return 'Undo'
    case 'REDO':
      return 'Redo'
    default:
      return 'Unknown action'
  }
}

function appendMovements(state: FinanceState, movements: Movement[]): Movement[] {
  const existing = new Set(state.movements.map((movement) => movement.id))
  return [...state.movements, ...movements.filter((movement) => !existing.has(movement.id))]
}

function mutate(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'ADD_MOVEMENTS':
      return { ...state, movements: appendMovements(state, action.payload) }

    case 'UPDATE_MOVEMENT':
      return {
        ...state,
        movements: state.movements.map((movement) =>
          movement.id === action.payload.id ? action.payload : movement,
        ),
      }

    case 'DELETE_MOVEMENT':
      return {
        ...state,
        movements: state.movements.filter((movement) => movement.id !== action.payload),
      }

    case 'DELETE_MOVEMENTS': {
      const deleted = new Set(action.payload)
      return {
        ...state,
        movements: state.movements.filter((movement) => !deleted.has(movement.id)),
      }
    }

    case 'UPSERT_BUDGET': {
      const budget = action.payload
      const index = state.budgets.findIndex(
        (candidate) => candidate.referenceMonth === budget.referenceMonth,
      )
      if (index >= 0) {
        const nextBudgets = [...state.budgets]
        nextBudgets[index] = budget
        return { ...state, budgets: nextBudgets }
      }
      return { ...state, budgets: [...state.budgets, budget] }
    }

    case 'DELETE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.filter((budget) => budget.referenceMonth !== action.payload),
      }

    case 'IMPORT':
      return {
        ...state,
        movements: action.payload.movements,
        budgets: action.payload.budgets,
      }

    default:
      return state
  }
}

const MUTATION_TYPES = new Set<FinanceAction['type']>([
  'ADD_MOVEMENTS',
  'UPDATE_MOVEMENT',
  'DELETE_MOVEMENT',
  'DELETE_MOVEMENTS',
  'UPSERT_BUDGET',
  'DELETE_BUDGET',
  'IMPORT',
])

function reducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        movements: action.payload.movements,
        budgets: action.payload.budgets,
        loaded: true,
      }

    case 'UNDO': {
      const entry = state.auditLog.find((candidate) => candidate.id === action.payload)
      if (!entry) return state
      return {
        ...state,
        movements: entry.snapshot.movements,
        budgets: entry.snapshot.budgets,
        auditLog: state.auditLog.filter((candidate) => candidate.id !== action.payload),
        redoStack: [{ ...entry, forwardSnapshot: snapshot(state) }, ...state.redoStack],
      }
    }

    case 'REDO': {
      const [redoEntry, ...rest] = state.redoStack
      if (!redoEntry?.forwardSnapshot) return state
      return {
        ...state,
        movements: redoEntry.forwardSnapshot.movements,
        budgets: redoEntry.forwardSnapshot.budgets,
        auditLog: [
          { ...redoEntry, snapshot: snapshot(state), forwardSnapshot: undefined },
          ...state.auditLog,
        ],
        redoStack: rest,
      }
    }

    case 'APPLY_REMOTE':
      return {
        ...state,
        movements: action.payload.movements,
        budgets: action.payload.budgets,
      }

    case 'CLEAR_AUDIT':
      return { ...state, auditLog: [], redoStack: [] }

    default: {
      if (!MUTATION_TYPES.has(action.type)) return state
      const before = snapshot(state)
      const next = mutate(state, action)
      return {
        ...next,
        auditLog: [
          {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            description: describeAction(action),
            snapshot: before,
            actionType: action.type,
          },
          ...state.auditLog,
        ].slice(0, 200),
      }
    }
  }
}

let state = $state.raw<FinanceState>({
  movements: [],
  budgets: [],
  auditLog: [],
  redoStack: [],
  loaded: false,
})

let saveHandle: number | null = null

function persist() {
  if (!state.loaded) return
  saveData({ movements: state.movements, budgets: state.budgets })
}

function scheduleSave() {
  if (saveHandle !== null) {
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(saveHandle)
    else window.clearTimeout(saveHandle)
  }
  saveHandle =
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(() => {
          saveHandle = null
          persist()
        })
      : window.setTimeout(() => {
          saveHandle = null
          persist()
        }, 0)
}

export const finance = {
  get state() {
    return state
  },
  dispatch(action: FinanceAction) {
    const next = reducer(state, action)
    if (next === state) return
    const dataChanged = next.movements !== state.movements || next.budgets !== state.budgets
    state = next
    if (dataChanged && next.loaded && action.type !== 'LOAD') scheduleSave()
  },
}

export function loadFinance() {
  const saved = loadData()
  state = {
    ...state,
    movements: saved?.movements ?? [],
    budgets: saved?.budgets ?? [],
    loaded: true,
  }
}

export function flushFinance() {
  persist()
}
