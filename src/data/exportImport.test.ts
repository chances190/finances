import { describe, expect, test } from 'bun:test'
import type { Budget } from '../domain/entities'
import {
  buildPurchase,
  fundingAccountOf,
  incomeAmount,
  movementTotal,
  outstanding,
} from '../domain/ledger'
import { importJSON } from './backup/json'
import { importCSV } from './exchange/csv'

const H =
  'ref,date,type,amount,category,paymentMethod,description,installmentTotal,installmentIndex,installmentRef,debtName,debtAmount'

const budget: Budget = {
  referenceMonth: '2026-07',
  plannedIncome: 5000,
  plannedMealVoucher: 0,
  investmentRate: 0.2,
  categoryLimits: { Food: 500 },
}

describe('importCSV', () => {
  test('parses an income row into a ledger movement', () => {
    const csv = `${H}\nr001,2026-07-05,Income,5000,Salary,Salary,Salary,,,,,`
    const { movements, skippedRows } = importCSV(csv)

    expect(skippedRows).toEqual([])
    expect(movements).toHaveLength(1)
    expect(movements[0].kind).toBe('income')
    expect(incomeAmount(movements[0])).toBe(5000)
    expect(fundingAccountOf(movements[0])).toBe('checking')
  })

  test('throws on empty CSV', () => {
    expect(() => importCSV('')).toThrow()
  })

  test('throws if missing required columns', () => {
    expect(() => importCSV('date,description\n2026-01-01,test')).toThrow()
  })

  test('skips malformed rows with reasons', () => {
    const csv = `${H}\nr001,2026-07-05,Income,5000,Salary,Salary,Salary,,,,,\nmalformed-row-with-no-commas`
    const { movements, skippedRows } = importCSV(csv)

    expect(movements).toHaveLength(1)
    expect(skippedRows).toHaveLength(1)
    expect(skippedRows[0].line).toBe(3)
    expect(skippedRows[0].reason).toContain('wrong number of columns')
  })

  test('skips rows that violate import rules, naming the offence', () => {
    const invalidRows = [
      {
        row: 'r001,2026-07-05,INVALID,5000,Salary,Debit/PIX,Salary,,,,,',
        reason: 'invalid type',
        detail: 'INVALID',
      },
      {
        row: 'r001,2026-07-05,Expense,5000,Food,UNKNOWN,Buy,,,,,',
        reason: 'invalid payment method',
        detail: 'UNKNOWN',
      },
      { row: 'r001,2026-07-05,Expense,abc,Food,Debit/PIX,Buy,,,,,', reason: 'invalid amount' },
      {
        row: 'r001,2026-07-05,Expense,100,Food,Salary,Buy,,,,,',
        reason: 'invalid payment method',
        detail: 'Salary',
      },
      {
        row: 'r001,2026-07-05,Income,5000,Salary,Debit/PIX,Salary,,,,,',
        reason: 'invalid payment method',
        detail: 'Debit/PIX',
      },
    ]

    for (const { row, reason, detail } of invalidRows) {
      const { movements, skippedRows } = importCSV(`${H}\n${row}`)

      expect(movements).toHaveLength(0)
      expect(skippedRows).toHaveLength(1)
      expect(skippedRows[0].reason).toContain(reason)
      if (detail) expect(skippedRows[0].reason).toContain(detail)
    }
  })

  test('canonicalizes uppercase type and payment method', () => {
    const csv = `${H}\nr001,2026-07-05,EXPENSE,10,Food,DEBIT/PIX,Buy,,,,,`
    const { movements, skippedRows } = importCSV(csv)

    expect(skippedRows).toEqual([])
    expect(movements[0].kind).toBe('purchase')
    expect(fundingAccountOf(movements[0])).toBe('checking')
  })

  test('imports shares from debt rows', () => {
    const csv = `${H}\nr001,2026-07-10,Expense,300,Food,Debit/PIX,Dinner,,,,Alice,100\nr001,2026-07-10,Expense,300,Food,Debit/PIX,Dinner,,,,Bob,200`
    const { movements } = importCSV(csv)

    expect(movements).toHaveLength(1)
    expect(movementTotal(movements[0])).toBe(300)
    expect(outstanding(movements, 'receivable')).toEqual([
      { counterparty: 'Alice', amount: 100 },
      { counterparty: 'Bob', amount: 200 },
    ])
  })

  test('imports installments as separate dated purchases', () => {
    const csv = `${H}\nr001,2026-07-01,Expense,1200,Electronics,Credit,TV,3,1,,,\nr002,2026-08-01,Expense,1200,Electronics,Credit,TV,,2,r001,,\nr003,2026-09-01,Expense,1200,Electronics,Credit,TV,,3,r001,,`
    const { movements } = importCSV(csv)

    expect(movements).toHaveLength(3)
    expect(movements.map((movement) => movement.date)).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
    ])
    expect(movements.map(movementTotal)).toEqual([400, 400, 400])
  })
})

describe('JSON import', () => {
  test('reads a ledger snapshot', () => {
    const purchase = buildPurchase({
      id: 'p1',
      date: '2026-07-15',
      description: 'Test',
      amount: 150.5,
      category: 'Food',
      account: 'checking',
    })
    if (!purchase.ok) throw new Error(purchase.reason)

    const result = importJSON(JSON.stringify({ movements: purchase.value, budgets: [budget] }))

    expect(result.data.movements).toHaveLength(1)
    expect(result.data.budgets).toEqual([budget])
    expect(result.skippedMovements).toEqual([])
  })

  test('migrates a legacy snapshot', () => {
    const legacy = {
      transactions: [
        {
          id: 'i1',
          type: 'Income',
          date: '2026-07-05',
          description: 'Salary',
          amount: 5000,
          category: 'Income',
          paymentMethod: 'Salary',
        },
      ],
      budgets: [budget],
    }

    const result = importJSON(JSON.stringify(legacy))

    expect(result.data.movements).toHaveLength(1)
    expect(result.data.movements[0].kind).toBe('income')
    expect(result.data.budgets).toEqual([budget])
  })

  test('throws on malformed JSON', () => {
    expect(() => importJSON('{')).toThrow()
  })
})
