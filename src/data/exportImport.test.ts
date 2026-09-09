import { describe, expect, test } from 'bun:test'
import { importJSON } from './backup/json'
import { importCSV } from './exchange/csv'

const H =
  'ref,date,type,amount,category,paymentMethod,description,installmentTotal,installmentIndex,installmentRef,debtName,debtAmount'

describe('importCSV', () => {
  test('parses a valid CSV', () => {
    const csv = `${H}\nr001,2026-07-05,INCOME,5000,Salary,DEBIT,Salary,,,,,`
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

  test('imports a debt with 1NF splits', () => {
    const csv = `${H}\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,,,,Alice,100\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,,,,Bob,200`
    const [t] = importCSV(csv)
    expect(t.debts).toHaveLength(2)
    expect(t.debts?.[0].name).toBe('Alice')
    expect(t.debts?.[0].amount).toBe(100)
    expect(t.debts?.[1].name).toBe('Bob')
    expect(t.debts?.[1].amount).toBe(200)
  })

  test('imports head-anchored installments', () => {
    const csv = `${H}\nr001,2026-07-01,EXPENSE,1200,Electronics,PIX,TV,3,1,,,\nr002,2026-08-01,EXPENSE,1200,Electronics,PIX,TV,,2,r001,,\nr003,2026-09-01,EXPENSE,1200,Electronics,PIX,TV,,3,r001,,`
    const result = importCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].installments).toBe(3)
    expect(result[0].amount).toBe(1200)
  })
})

describe('CSV round-trip', () => {
  test('simple transaction preserves data', () => {
    const csv = `${H}\nr001,2026-07-15,EXPENSE,150.5,Food,PIX,Test transaction,,,,,`
    const [t] = importCSV(csv)
    expect(t.amount).toBe(150.5)
    expect(t.description).toBe('Test transaction')
  })
})

describe('importJSON', () => {
  test('round-trips transactions and budgets', () => {
    const data = {
      _version: 2,
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
    expect(result.transactions).toEqual(data.transactions)
    expect(result.budgets).toEqual(data.budgets)
  })

  test('rejects old format without _version', () => {
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
        },
      ],
      budgets: [],
    }
    expect(() => importJSON(JSON.stringify(data))).toThrow('Incompatible data format')
  })
})
