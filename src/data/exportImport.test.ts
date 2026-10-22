import { describe, expect, test } from 'bun:test'
import type { FinanceData } from '../domain/entities'
import { importJSON } from './backup/json'
import { importCSV } from './exchange/csv'

const H =
  'ref,date,type,amount,category,paymentMethod,description,installmentTotal,installmentIndex,installmentRef,debtName,debtAmount'

describe('importCSV', () => {
  test('parses a valid CSV', () => {
    const csv = `${H}\nr001,2026-07-05,Income,5000,Salary,Salary,Salary,,,,,`
    const { transactions, skippedRows } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(skippedRows).toEqual([])
    expect(transactions[0].amount).toBe(5000)
    expect(transactions[0].type).toBe('Income')
    expect(transactions[0].paymentMethod).toBe('Salary')
  })

  test('throws on empty CSV', () => {
    expect(() => importCSV('')).toThrow()
  })

  test('throws if missing required columns', () => {
    expect(() => importCSV('date,description\n2026-01-01,test')).toThrow()
  })

  test('skips malformed rows with reasons', () => {
    const csv = `${H}\nr001,2026-07-05,Income,5000,Salary,Salary,Salary,,,,,\nmalformed-row-with-no-commas`
    const { transactions, skippedRows } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(skippedRows).toHaveLength(1)
    expect(skippedRows[0].line).toBe(3)
    expect(skippedRows[0].reason).toContain('wrong number of columns')
  })

  test('skips rows that violate import rules, naming the offence', () => {
    const invalidRows = [
      {
        row: 'r001,2026-07-05,INVALID,5000,Salary,Debit,Salary,,,,,',
        reason: 'invalid type',
        detail: 'INVALID',
      },
      {
        row: 'r001,2026-07-05,Expense,5000,Food,UNKNOWN,Buy,,,,,',
        reason: 'invalid payment method',
        detail: 'UNKNOWN',
      },
      { row: 'r001,2026-07-05,Expense,abc,Food,Debit,Buy,,,,,', reason: 'invalid amount' },
      {
        row: 'r001,2026-07-05,Expense,100,Food,Salary,Buy,,,,,',
        reason: 'invalid payment method',
        detail: 'Salary',
      },
      {
        row: 'r001,2026-07-05,Income,5000,Salary,Debit,Salary,,,,,',
        reason: 'invalid payment method',
        detail: 'Debit',
      },
    ]

    for (const { row, reason, detail } of invalidRows) {
      const { transactions, skippedRows } = importCSV(`${H}\n${row}`)

      expect(transactions).toHaveLength(0)
      expect(skippedRows).toHaveLength(1)
      expect(skippedRows[0].reason).toContain(reason)
      if (detail) expect(skippedRows[0].reason).toContain(detail)
    }
  })

  test('canonicalizes uppercase type and payment method', () => {
    const csv = `${H}\nr001,2026-07-05,EXPENSE,10,Food,DEBIT,Buy,,,,,`
    const { transactions, skippedRows } = importCSV(csv)

    expect(skippedRows).toEqual([])
    expect(transactions[0]).toMatchObject({ type: 'Expense', paymentMethod: 'Debit' })
  })

  test('imports a debt with 1NF splits', () => {
    const csv = `${H}\nr001,2026-07-10,Expense,300,Food,Debit,Dinner,,,,Alice,100\nr001,2026-07-10,Expense,300,Food,Debit,Dinner,,,,Bob,200`
    const { transactions } = importCSV(csv)
    const [t] = transactions
    if (t.type !== 'Expense') throw new Error('expected an expense')
    expect(t.debts).toHaveLength(2)
    expect(t.debts?.[0].name).toBe('Alice')
    expect(t.debts?.[0].amount).toBe(100)
    expect(t.debts?.[1].name).toBe('Bob')
    expect(t.debts?.[1].amount).toBe(200)
  })

  test('imports head-anchored installments', () => {
    const csv = `${H}\nr001,2026-07-01,Expense,1200,Electronics,Credit,TV,3,1,,,\nr002,2026-08-01,Expense,1200,Electronics,Credit,TV,,2,r001,,\nr003,2026-09-01,Expense,1200,Electronics,Credit,TV,,3,r001,,`
    const { transactions } = importCSV(csv)
    expect(transactions).toHaveLength(1)
    const [t] = transactions
    if (t.type !== 'Expense') throw new Error('expected an expense')
    expect(t.installments).toBe(3)
    expect(t.amount).toBe(1200)
  })

  test('reports multiple skipped rows with reasons', () => {
    const csv = `${H}\nr001,2026-07-05,Income,5000,Salary,Salary,Salary,,,,,\nr002,2026-07-06,INVALID,10,Food,Debit,Bread,,,,,\nbad-row`
    const { skippedRows } = importCSV(csv)
    expect(skippedRows).toHaveLength(2)
    expect(skippedRows[0].reason).toContain('invalid type')
    expect(skippedRows[1].reason).toContain('wrong number of columns')
  })
})

describe('CSV round-trip', () => {
  test('simple transaction preserves data', () => {
    const csv = `${H}\nr001,2026-07-15,Expense,150.5,Food,Debit,Test transaction,,,,,`
    const { transactions } = importCSV(csv)
    const [t] = transactions
    expect(t.amount).toBe(150.5)
    expect(t.description).toBe('Test transaction')
  })
})

describe('importJSON', () => {
  test('round-trips transactions and budgets', () => {
    const data: FinanceData = {
      transactions: [
        {
          id: 'tx-1',
          type: 'Expense',
          date: '2026-07-01',
          description: 'Groceries',
          amount: 120.5,
          category: 'Food',
          paymentMethod: 'Debit',
        },
      ],
      budgets: [
        {
          referenceMonth: '2026-07',
          plannedIncome: 5000,
          plannedMealVoucher: 500,
          investmentRate: 0.2,
          categoryLimits: { Food: 1000 },
        },
      ],
    }
    const result = importJSON(JSON.stringify(data))
    expect(result.data.transactions).toEqual(data.transactions)
    expect(result.data.budgets).toEqual(data.budgets)
    expect(result.skippedTransactions).toHaveLength(0)
    expect(result.skippedBudgets).toBe(0)
  })

  test('reports skipped transactions with reasons', () => {
    const data = {
      transactions: [
        {
          id: 'tx-1',
          type: 'INVALID',
          date: '2026-07-01',
          description: 'Bad',
          amount: 100,
          category: 'Other',
          paymentMethod: 'Debit',
        },
      ],
      budgets: [{ referenceMonth: '2026-07' }],
    }
    const result = importJSON(JSON.stringify(data))
    expect(result.data.transactions).toHaveLength(0)
    expect(result.skippedTransactions).toHaveLength(1)
    expect(result.skippedTransactions[0].reason).toContain('invalid type')
    expect(result.skippedBudgets).toBe(1)
  })

  test('reports income with expense payment method', () => {
    const data = {
      transactions: [
        {
          id: 'tx-1',
          type: 'Income',
          date: '2026-07-01',
          description: 'Salary',
          amount: 5000,
          category: 'Salary',
          paymentMethod: 'Debit',
        },
      ],
      budgets: [],
    }
    const result = importJSON(JSON.stringify(data))
    expect(result.data.transactions).toHaveLength(0)
    expect(result.skippedTransactions).toHaveLength(1)
    expect(result.skippedTransactions[0].reason).toContain('invalid payment method')
    expect(result.skippedTransactions[0].reason).toContain('Debit')
  })
})
