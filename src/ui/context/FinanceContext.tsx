import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useReducer,
} from 'react'
import { loadData, saveData } from '../../data/repository'
import { generateSeed } from '../../data/seed'
import type { Budget, FinanceData, Transaction } from '../../domain/entities'

export interface FinanceState {
  transactions: Transaction[]
  budgets: Budget[]
  loaded: boolean
}

export type FinanceAction =
  | { type: 'LOAD'; payload: FinanceData }
  | { type: 'ADD_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SETTLE_TRANSACTION'; payload: string }
  | { type: 'UPSERT_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'SEED' }
  | { type: 'IMPORT'; payload: FinanceData }

function reducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        transactions: action.payload.transactions,
        budgets: action.payload.budgets,
        loaded: true,
      }

    case 'ADD_TRANSACTIONS':
      return { ...state, transactions: [...state.transactions, ...action.payload] }

    case 'UPDATE_TRANSACTION': {
      const updated = action.payload
      return {
        ...state,
        transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
      }
    }

    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => {
          if (t.id === action.payload) return false
          if (t.groupId === action.payload) return false
          return true
        }),
      }

    case 'SETTLE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.parentId === action.payload || t.id === action.payload ? { ...t, isSettled: true } : t,
        ),
      }

    case 'UPSERT_BUDGET': {
      const budget = action.payload
      const idx = state.budgets.findIndex((b) => b.referenceMonth === budget.referenceMonth)
      if (idx >= 0) {
        const next = [...state.budgets]
        next[idx] = budget
        return { ...state, budgets: next }
      }
      return { ...state, budgets: [...state.budgets, budget] }
    }

    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter((b) => b.referenceMonth !== action.payload) }

    case 'SEED': {
      return { ...state, ...generateSeed(), loaded: true }
    }

    case 'IMPORT':
      return {
        ...state,
        transactions: action.payload.transactions,
        budgets: action.payload.budgets,
        loaded: true,
      }

    default:
      return state
  }
}

const FinanceContext = createContext<{
  state: FinanceState
  dispatch: Dispatch<FinanceAction>
} | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { transactions: [], budgets: [], loaded: false })

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
