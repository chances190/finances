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
  loaded: boolean
}

export type FinanceAction =
  | { type: 'LOAD'; payload: FinanceData }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[]; description?: string }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction; description?: string }
  | { type: 'DELETE_TRANSACTION'; payload: string; description?: string }
  | { type: 'SETTLE_TRANSACTION'; payload: string; settled?: boolean; description?: string }
  | { type: 'UPSERT_BUDGET'; payload: Budget; description?: string }
  | { type: 'DELETE_BUDGET'; payload: string; description?: string }
  | { type: 'SEED' }
  | { type: 'IMPORT'; payload: FinanceData; description?: string }
  | { type: 'UNDO'; payload: string }
  | { type: 'CLEAR_AUDIT' }

function snapshot(state: FinanceState): { transactions: Transaction[]; budgets: Budget[] } {
  return { transactions: [...state.transactions], budgets: [...state.budgets] }
}

function describeAction(action: FinanceAction): string {
  switch (action.type) {
    case 'ADD_TRANSACTIONS':
      return action.description ?? `Added ${action.payload.length} transaction(s)`
    case 'UPDATE_TRANSACTION':
      return action.description ?? `Updated transaction "${action.payload.description}"`
    case 'DELETE_TRANSACTION':
      return action.description ?? `Deleted transaction`
    case 'SETTLE_TRANSACTION':
      return (
        action.description ??
        (action.settled === false ? 'Unsettled transaction' : 'Settled transaction')
      )
    case 'UPSERT_BUDGET':
      return action.description ?? `Saved budget for ${action.payload.referenceMonth}`
    case 'DELETE_BUDGET':
      return action.description ?? `Deleted budget for ${action.payload}`
    case 'IMPORT':
      return action.description ?? `Imported ${action.payload.transactions.length} transaction(s)`
    case 'SEED':
      return 'Loaded seed data'
    case 'UNDO':
      return 'Undo'
    default:
      return 'Unknown action'
  }
}

function withAudit(
  state: FinanceState,
  action: FinanceAction & { description?: string },
): FinanceState {
  const before = snapshot(state)
  let next: FinanceState

  switch (action.type) {
    case 'ADD_TRANSACTIONS':
      next = { ...state, transactions: [...state.transactions, ...action.payload] }
      break

    case 'UPDATE_TRANSACTION': {
      const updated = action.payload
      next = {
        ...state,
        transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
      }
      break
    }

    case 'DELETE_TRANSACTION': {
      const target = state.transactions.find((t) => t.id === action.payload)
      const idsToDelete = new Set<string>()
      if (target) {
        idsToDelete.add(target.id)
        if (target.groupId) {
          state.transactions
            .filter((t) => t.groupId === target.groupId)
            .forEach((t) => idsToDelete.add(t.id))
        }
      }
      next = {
        ...state,
        transactions: state.transactions.filter((t) => !idsToDelete.has(t.id)),
      }
      break
    }

    case 'SETTLE_TRANSACTION': {
      const settled = action.settled ?? true
      next = {
        ...state,
        transactions: state.transactions.map((t) =>
          t.parentId === action.payload || t.id === action.payload
            ? { ...t, isSettled: settled }
            : t,
        ),
      }
      break
    }

    case 'UPSERT_BUDGET': {
      const budget = action.payload
      const idx = state.budgets.findIndex((b) => b.referenceMonth === budget.referenceMonth)
      if (idx >= 0) {
        const nextBudgets = [...state.budgets]
        nextBudgets[idx] = budget
        next = { ...state, budgets: nextBudgets }
      } else {
        next = { ...state, budgets: [...state.budgets, budget] }
      }
      break
    }

    case 'DELETE_BUDGET':
      next = { ...state, budgets: state.budgets.filter((b) => b.referenceMonth !== action.payload) }
      break

    case 'IMPORT':
      next = {
        ...state,
        transactions: action.payload.transactions,
        budgets: action.payload.budgets,
      }
      break

    case 'SEED':
      next = { ...state, ...generateSeed(), loaded: true }
      break

    default:
      return state
  }

  const entry: AuditEntry = {
    id: uuid(),
    timestamp: Date.now(),
    description: describeAction(action),
    snapshot: before,
    actionType: action.type,
  }

  return { ...next, auditLog: [entry, ...state.auditLog].slice(0, 200) }
}

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
      }
    }

    case 'CLEAR_AUDIT':
      return { ...state, auditLog: [] }

    case 'ADD_TRANSACTIONS':
    case 'UPDATE_TRANSACTION':
    case 'DELETE_TRANSACTION':
    case 'SETTLE_TRANSACTION':
    case 'UPSERT_BUDGET':
    case 'DELETE_BUDGET':
    case 'IMPORT':
    case 'SEED':
      return withAudit(state, action)

    default:
      return state
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
