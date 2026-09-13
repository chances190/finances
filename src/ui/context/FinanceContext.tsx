import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
} from 'react'
import { v4 as uuid } from 'uuid'
import { loadData, saveData } from '../../data/repository'
import { generateSeed } from '../../data/seed'
import type { AuditEntry, Budget, FinanceData, Transaction } from '../../domain/entities'

export interface FinanceState {
  transactions: Transaction[]
  budgets: Budget[]
  auditLog: AuditEntry[]
  redoStack: AuditEntry[]
  loaded: boolean
}

export type FinanceAction =
  | { type: 'LOAD'; payload: FinanceData }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SETTLE_DEBT'; payload: { transactionId: string; debtName: string } }
  | { type: 'UPSERT_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'SEED' }
  | { type: 'IMPORT'; payload: FinanceData }
  | { type: 'UNDO'; payload: string }
  | { type: 'REDO' }
  | { type: 'CLEAR_AUDIT' }

function snapshot(state: FinanceState): { transactions: Transaction[]; budgets: Budget[] } {
  return { transactions: [...state.transactions], budgets: [...state.budgets] }
}

function describeAction(action: FinanceAction): string {
  switch (action.type) {
    case 'ADD_TRANSACTIONS':
      return `Added ${action.payload.length} transaction(s)`
    case 'UPDATE_TRANSACTION':
      return `Updated transaction "${action.payload.description}"`
    case 'DELETE_TRANSACTION':
      return `Deleted transaction`
    case 'SETTLE_DEBT':
      return `Settled debt "${action.payload.debtName}"`
    case 'UPSERT_BUDGET':
      return `Saved budget for ${action.payload.referenceMonth}`
    case 'DELETE_BUDGET':
      return `Deleted budget for ${action.payload}`
    case 'IMPORT':
      return `Imported ${action.payload.transactions.length} transaction(s)`
    case 'SEED':
      return 'Loaded seed data'
    case 'UNDO':
      return 'Undo'
    case 'REDO':
      return 'Redo'
    default:
      return 'Unknown action'
  }
}

function mutate(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'ADD_TRANSACTIONS':
      return { ...state, transactions: [...state.transactions, ...action.payload] }

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t,
        ),
      }

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
      }

    case 'SETTLE_DEBT': {
      const { transactionId, debtName } = action.payload
      return {
        ...state,
        transactions: state.transactions.map((t) => {
          if (t.id !== transactionId || !t.debts) return t
          return {
            ...t,
            debts: t.debts.map((d) => (d.name === debtName ? { ...d, settled: !d.settled } : d)),
          }
        }),
      }
    }

    case 'UPSERT_BUDGET': {
      const budget = action.payload
      const idx = state.budgets.findIndex((b) => b.referenceMonth === budget.referenceMonth)
      if (idx >= 0) {
        const nextBudgets = [...state.budgets]
        nextBudgets[idx] = budget
        return { ...state, budgets: nextBudgets }
      }
      return { ...state, budgets: [...state.budgets, budget] }
    }

    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter((b) => b.referenceMonth !== action.payload) }

    case 'IMPORT':
      return {
        ...state,
        transactions: action.payload.transactions,
        budgets: action.payload.budgets,
      }

    case 'SEED':
      return { ...state, ...generateSeed(), loaded: true }

    default:
      return state
  }
}

const MUTATION_TYPES = new Set<FinanceAction['type']>([
  'ADD_TRANSACTIONS',
  'UPDATE_TRANSACTION',
  'DELETE_TRANSACTION',
  'SETTLE_DEBT',
  'UPSERT_BUDGET',
  'DELETE_BUDGET',
  'IMPORT',
  'SEED',
])

function reducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        transactions: action.payload.transactions,
        budgets: action.payload.budgets,
        loaded: true,
      }

    case 'UNDO': {
      const entry = state.auditLog.find((e) => e.id === action.payload)
      if (!entry) return state
      return {
        ...state,
        transactions: entry.snapshot.transactions,
        budgets: entry.snapshot.budgets,
        auditLog: state.auditLog.filter((e) => e.id !== action.payload),
        redoStack: [{ ...entry, forwardSnapshot: snapshot(state) }, ...state.redoStack],
      }
    }

    case 'REDO': {
      const [redoEntry, ...rest] = state.redoStack
      if (!redoEntry?.forwardSnapshot) return state
      return {
        ...state,
        transactions: redoEntry.forwardSnapshot.transactions,
        budgets: redoEntry.forwardSnapshot.budgets,
        auditLog: [
          { ...redoEntry, snapshot: snapshot(state), forwardSnapshot: undefined },
          ...state.auditLog,
        ],
        redoStack: rest,
      }
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
            id: uuid(),
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
    transactions: [],
    budgets: [],
    auditLog: [],
    redoStack: [],
    loaded: false,
  })

  useEffect(() => {
    const saved = loadData()
    if (saved) {
      dispatch({ type: 'LOAD', payload: saved })
    } else {
      dispatch({ type: 'SEED' })
    }
  }, [])

  useEffect(() => {
    if (state.loaded) {
      saveData({ transactions: state.transactions, budgets: state.budgets })
    }
  }, [state.transactions, state.budgets, state.loaded])

  return <FinanceContext.Provider value={{ state, dispatch }}>{children}</FinanceContext.Provider>
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
