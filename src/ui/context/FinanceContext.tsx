import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react'
import { loadData, saveData } from '../../data/repository'
import type { AuditEntry, Budget, FinanceData } from '../../domain/entities'
import type { Movement } from '../../domain/ledger'

function scheduleSave(callback: () => void): number {
  return typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(callback)
    : window.setTimeout(callback, 0)
}

function cancelSave(handle: number): void {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle)
  } else {
    window.clearTimeout(handle)
  }
}

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
  // Every reducer mutation replaces these arrays instead of mutating them, so
  // snapshots can share the references without an O(n) copy per action.
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

const FinanceContext = createContext<{
  state: FinanceState
  dispatch: Dispatch<FinanceAction>
} | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    movements: [],
    budgets: [],
    auditLog: [],
    redoStack: [],
    loaded: false,
  })

  const skipInitialSave = useRef(true)
  const latestState = useRef(state)

  useEffect(() => {
    latestState.current = state
  }, [state])

  useEffect(() => {
    const saved = loadData()
    dispatch({ type: 'LOAD', payload: saved ?? { movements: [], budgets: [] } })
  }, [])

  useEffect(() => {
    if (!state.loaded) return
    if (skipInitialSave.current) {
      skipInitialSave.current = false
      return
    }
    const handle = scheduleSave(() =>
      saveData({ movements: state.movements, budgets: state.budgets }),
    )
    return () => cancelSave(handle)
  }, [state.movements, state.budgets, state.loaded])

  useEffect(() => {
    const flush = () => {
      if (!latestState.current.loaded) return
      saveData({
        movements: latestState.current.movements,
        budgets: latestState.current.budgets,
      })
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  return <FinanceContext.Provider value={{ state, dispatch }}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const context = useContext(FinanceContext)
  if (!context) throw new Error('useFinance must be used within FinanceProvider')
  return context
}
