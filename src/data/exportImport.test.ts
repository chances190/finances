import { describe, expect, test } from 'bun:test'
import { importCSV, importJSON } from './exportImport'

const H =
  'ref,date,type,amount,category,paymentMethod,description,referenceMonth,isDebt,debtorName,debtAmount,debtUserShare,isSettled,installmentTotal,installmentCurrent,installmentRef'

describe('importCSV', () => {
  test('parses a valid CSV', () => {
    const csv = `${H}\nr001,2026-07-05,INCOME,5000,Salary,DEBIT,Salary,2026-07,false,,,0,false,,,`
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
    const csv = `${H}\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,2026-07,true,Alice,100,150,true,,,\nr001,2026-07-10,EXPENSE,300,Food,DEBIT,Dinner,2026-07,true,Bob,100,150,false,,,`
    const [t] = importCSV(csv)
    expect(t.isDebt).toBe(true)
    expect(t.debtSplits).toHaveLength(2)
    expect(t.debtSplits?.[0].debtorName).toBe('Alice')
    expect(t.debtSplits?.[0].amount).toBe(100)
    expect(t.debtSplits?.[1].debtorName).toBe('Bob')
    expect(t.debtUserShare).toBe(150)
  })

  test('imports head-anchored installments', () => {
    const csv = `${H}\nr001,2026-07-01,EXPENSE,1200,Electronics,PIX,TV,2026-07,false,,,0,false,3,1,\nr002,2026-08-01,EXPENSE,1200,Electronics,PIX,TV,2026-08,false,,,0,false,,2,r001\nr003,2026-09-01,EXPENSE,1200,Electronics,PIX,TV,2026-09,false,,,0,false,,3,r001`
    const result = importCSV(csv)
    expect(result).toHaveLength(3)

    const head = result.find((t) => t.installment?.current === 1)
    expect(head).toBeDefined()
    expect(head?.installment?.total).toBe(3)
    expect(head?.groupId).toBeDefined()

    const headId = head?.id
    const child2 = result.find((t) => t.installment?.current === 2)
    expect(child2?.parentId).toBe(headId)
    expect(child2?.groupId).toBe(headId)
    expect(child2?.installment?.total).toBe(3)

    const child3 = result.find((t) => t.installment?.current === 3)
    expect(child3?.parentId).toBe(headId)
    expect(child3?.groupId).toBe(headId)
    expect(child3?.installment?.total).toBe(3)
  })
})

describe('CSV round-trip', () => {
  test('simple transaction preserves data', () => {
    const csv = `${H}\nr001,2026-07-15,EXPENSE,150.5,Food,PIX,Test transaction,2026-07,false,,,0,false,,,`
    const [t] = importCSV(csv)
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
