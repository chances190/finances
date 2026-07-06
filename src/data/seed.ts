import { v4 as uuid } from 'uuid'
import type { Budget, FinanceData, Transaction } from '../domain/entities'

function tx(refYear: number, refMonth: string, overrides: Partial<Transaction>): Transaction {
  return {
    id: uuid(),
    type: 'EXPENSE',
    date: `${refYear}-${refMonth}-01`,
    referenceMonth: `${refYear}-${refMonth}`,
    description: '',
    amount: 0,
    category: 'Other',
    paymentMethod: 'DEBIT',
    isDebt: false,
    isSettled: false,
    ...overrides,
  }
}

export function generateSeed(now: Date = new Date('2026-07-01')): FinanceData {
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const nextMonthNum = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2
  const nextMonth = String(nextMonthNum).padStart(2, '0')
  const nextYear = now.getMonth() + 2 > 12 ? currentYear + 1 : currentYear

  const ym = `${currentYear}-${currentMonth}`

  const transactions: Transaction[] = [
    tx(currentYear, currentMonth, {
      type: 'INCOME',
      date: `${ym}-05`,
      referenceMonth: ym,
      description: 'Salary',
      amount: 5000,
      category: 'Salary',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      type: 'INCOME',
      date: `${ym}-05`,
      referenceMonth: ym,
      description: 'Meal Voucher',
      amount: 800,
      category: 'Salary',
      paymentMethod: 'MEAL_VOUCHER',
    }),

    tx(currentYear, currentMonth, {
      date: `${ym}-03`,
      referenceMonth: ym,
      description: 'Rent',
      amount: 1200,
      category: 'Rent',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-02`,
      referenceMonth: ym,
      description: 'Supermarket',
      amount: 350,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-08`,
      referenceMonth: ym,
      description: 'Supermarket',
      amount: 120,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-15`,
      referenceMonth: ym,
      description: 'Supermarket',
      amount: 200,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-22`,
      referenceMonth: ym,
      description: 'Supermarket',
      amount: 180,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-04`,
      referenceMonth: ym,
      description: 'Bus pass',
      amount: 50,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-10`,
      referenceMonth: ym,
      description: 'Gas',
      amount: 35,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-17`,
      referenceMonth: ym,
      description: 'Gas',
      amount: 40,
      category: 'Transport',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-23`,
      referenceMonth: ym,
      description: 'Uber',
      amount: 25,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-06`,
      referenceMonth: ym,
      description: 'Dinner out',
      amount: 150,
      category: 'Leisure',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-13`,
      referenceMonth: ym,
      description: 'Cinema',
      amount: 80,
      category: 'Leisure',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-20`,
      referenceMonth: ym,
      description: 'Restaurant',
      amount: 200,
      category: 'Leisure',
      paymentMethod: 'CREDIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-10`,
      referenceMonth: ym,
      description: 'Electricity bill',
      amount: 150,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-15`,
      referenceMonth: ym,
      description: 'Water bill',
      amount: 80,
      category: 'Utilities',
      paymentMethod: 'PIX',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-12`,
      referenceMonth: ym,
      description: 'Pharmacy',
      amount: 200,
      category: 'Health',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-18`,
      referenceMonth: ym,
      description: 'Clothes',
      amount: 350,
      category: 'Shopping',
      paymentMethod: 'CREDIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-25`,
      referenceMonth: ym,
      description: 'Online course',
      amount: 180,
      category: 'Education',
      paymentMethod: 'DEBIT',
    }),
    tx(currentYear, currentMonth, {
      date: `${ym}-28`,
      referenceMonth: ym,
      description: 'Internet',
      amount: 120,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),

    tx(currentYear, currentMonth, {
      date: `${ym}-20`,
      referenceMonth: ym,
      description: 'Loan to João',
      amount: 200,
      category: 'Other',
      paymentMethod: 'PIX',
      isDebt: true,
      debtorName: 'João',
      debtSplits: [{ debtorName: 'João', amount: 200 }],
      isSettled: false,
    }),

    // CREDIT INSTALLMENT: TV 12x R$300
    ...(() => {
      const installmentGroupId = uuid()
      const installments: Transaction[] = []
      for (let i = 1; i <= 12; i++) {
        const refMonthNum = now.getMonth() + 1 + i
        const refY = currentYear + Math.floor((refMonthNum - 1) / 12)
        const refM = String(((refMonthNum - 1) % 12) + 1).padStart(2, '0')
        installments.push(
          tx(currentYear, currentMonth, {
            date: `${ym}-15`,
            referenceMonth: `${refY}-${refM}`,
            description: `TV - ${i}/${12}`,
            amount: 300,
            category: 'Shopping',
            paymentMethod: 'CREDIT',
            parentId: installmentGroupId,
            groupId: installmentGroupId,
            installment: { current: i, total: 12 },
            isSettled: false,
          }),
        )
      }
      return installments
    })(),
  ]

  const budgets: Budget[] = [
    {
      referenceMonth: ym,
      plannedIncome: 5000,
      plannedMealVoucher: 800,
      categoryLimits: {
        Food: 1000,
        Transport: 400,
        Rent: 1300,
        Leisure: 500,
        Utilities: 200,
        Health: 300,
        Shopping: 400,
        Education: 200,
      },
    },
    {
      referenceMonth: `${nextYear}-${nextMonth}`,
      plannedIncome: 5000,
      plannedMealVoucher: 800,
      categoryLimits: {
        Food: 1000,
        Transport: 400,
        Rent: 1300,
        Leisure: 500,
        Utilities: 200,
        Health: 300,
        Shopping: 400,
        Education: 200,
      },
    },
  ]

  return { transactions, budgets }
}
