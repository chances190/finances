import { describe, expect, test } from 'bun:test'
import type { Transaction } from '../domain/entities'
import { importCSV, importJSON } from './exportImport'

describe('importCSV', () => {
  test('parses a valid CSV', () => {
    const csv = `date,type,amount,category,paymentMethod,description,referenceMonth,isDebt,debtorName,debtUserShare,debtNames,debtAmounts,isSettled,installmentTotal,installmentCurrent,parentId,groupId
2026-07-05,INCOME,5000,Salary,DEBIT,Salary,2026-07,false,,,,,false,,,,`
    const result = importCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5000)
    expect(result[0].type).toBe('INCOME')
    expect(result[0].paymentMethod).toBe('DEBIT')
  })

  test('throws on empty CSV', () => {
    expect(() => importCSV('')).toThrow()
  })

  test('throws if missing required columns', () => {
    expect(() => importCSV('date,description\n2026-01-01,test')).toThrow()
  })
})

describe('CSV round-trip', () => {
  test('importing exported CSV preserves data', () => {
    const tx: Transaction = {
      id: 'test-1',
      type: 'EXPENSE',
      date: '2026-07-15',
      referenceMonth: '2026-07',
      description: 'Test transaction',
      amount: 150.5,
      category: 'Food',
      paymentMethod: 'PIX',
      isDebt: false,
      isSettled: false,
    }
    const csv = `date,type,amount,category,paymentMethod,description,referenceMonth,isDebt,debtorName,debtUserShare,debtNames,debtAmounts,isSettled,installmentTotal,installmentCurrent,parentId,groupId
${tx.date},${tx.type},${tx.amount},${tx.category},${tx.paymentMethod},${tx.description},${tx.referenceMonth},${tx.isDebt},,,,,${tx.isSettled},,,,`
    const result = importCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(tx.amount)
    expect(result[0].description).toBe(tx.description)
  })
})

describe('importJSON', () => {
  test('round-trips transactions and budgets from an exported file', () => {
    const data = {
      transactions: [
        {
          id: 'tx-1',
          type: 'EXPENSE',
          date: '2026-07-01',
          referenceMonth: '2026-07',
          description: 'Groceries',
          amount: 120.5,
          category: 'Food',
          paymentMethod: 'DEBIT',
          isDebt: false,
          isSettled: false,
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
    expect(result.transactions).toEqual(data.transactions)
    expect(result.budgets).toEqual(data.budgets)
  })
})
