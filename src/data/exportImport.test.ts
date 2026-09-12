import { describe, expect, test } from 'bun:test'
import { importJSON } from './backup/json'
import { importCSV } from './exchange/csv'

const H =
  'ref,date,type,amount,category,paymentMethod,description,installmentTotal,installmentIndex,installmentRef,debtName,debtAmount'

describe('importCSV', () => {
  test('parses a valid CSV', () => {
    const csv = `${H}\nr001,2026-07-05,INCOME,5000,Salary,DEBIT,Salary,,,,,`
    const { transactions, skippedRows } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(skippedRows).toEqual([])
    expect(transactions[0].amount).toBe(5000)
    expect(transactions[0].type).toBe('INCOME')
    expect(transactions[0].paymentMethod).toBe('DEBIT')
  })

  test('throws on empty CSV', () => {
    expect(() => importCSV('')).toThrow()
  })

  test('throws if missing required columns', () => {
    expect(() => importCSV('date,description\n2026-01-01,test')).toThrow()
  })

  test('imports a debt with 1NF splits', () => {
    const csv = `${H}\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,,,,Alice,100\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,,,,Bob,200`
    const { transactions } = importCSV(csv)
    const [t] = transactions
    expect(t.debts).toHaveLength(2)
    expect(t.debts?.[0].name).toBe('Alice')
    expect(t.debts?.[0].amount).toBe(100)
    expect(t.debts?.[1].name).toBe('Bob')
    expect(t.debts?.[1].amount).toBe(200)
  })

  test('imports head-anchored installments', () => {
    const csv = `${H}\nr001,2026-07-01,EXPENSE,1200,Electronics,PIX,TV,3,1,,,\nr002,2026-08-01,EXPENSE,1200,Electronics,PIX,TV,,2,r001,,\nr003,2026-09-01,EXPENSE,1200,Electronics,PIX,TV,,3,r001,,`
    const { transactions } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].installments).toBe(3)
    expect(transactions[0].amount).toBe(1200)
  })

  test('reports malformed rows as skipped with line numbers', () => {
    const csv = `${H}\nr001,2026-07-05,INCOME,5000,Salary,DEBIT,Salary,,,,,\nmalformed-row-with-no-commas`
    const { transactions, skippedRows } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(skippedRows).toEqual([3])
  })

  test('reports multiple malformed rows with their line numbers', () => {
    const csv = `${H}\nr001,2026-07-05,INCOME,5000,Salary,DEBIT,Salary,,,,,\nbad-row\nr002,2026-07-06,EXPENSE,10,Food,DEBIT,Bread,,,,,\nalso-bad`
    const { skippedRows } = importCSV(csv)
    expect(skippedRows).toEqual([3, 5])
  })
})

describe('CSV round-trip', () => {
  test('simple transaction preserves data', () => {
    const csv = `${H}\nr001,2026-07-15,EXPENSE,150.5,Food,PIX,Test transaction,,,,,`
    const { transactions } = importCSV(csv)
    const [t] = transactions
    expect(t.amount).toBe(150.5)
    expect(t.description).toBe('Test transaction')
  })
})

describe('importJSON', () => {
  test('round-trips transactions and budgets', () => {
    const data = {
      transactions: [
        {
          id: 'tx-1',
          type: 'EXPENSE',
          date: '2026-07-01',
          description: 'Groceries',
          amount: 120.5,
          category: 'Food',
          paymentMethod: 'DEBIT',
        },
      ],
      budgets: [
        {
          referenceMonth: '2026-07',
          plannedIncome: 5000,
          plannedMealVoucher: 500,
          categoryLimits: { Food: 1000 },
        },
      ],
    }
    const result = importJSON(JSON.stringify(data))
    expect(result.data.transactions).toEqual(data.transactions)
    expect(result.data.budgets).toEqual(data.budgets)
    expect(result.skippedTransactions).toBe(0)
    expect(result.skippedBudgets).toBe(0)
  })

  test('surfaces skipped rows for invalid entries', () => {
    const data = {
      transactions: [
        {
          id: 'tx-1',
          type: 'INVALID',
          date: '2026-07-01',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'DEBIT',
        },
      ],
      budgets: [{ referenceMonth: '2026-07' }],
    }
    const result = importJSON(JSON.stringify(data))
    expect(result.data.transactions).toHaveLength(0)
    expect(result.skippedTransactions).toBe(1)
    expect(result.skippedBudgets).toBe(1)
  })
})
