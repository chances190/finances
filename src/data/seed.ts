import { v4 as uuid } from 'uuid'
import type { Budget, FinanceData, Transaction } from '../domain/entities'

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
const nextMonth = String(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2).padStart(2, '0')
const nextYear = now.getMonth() + 2 > 12 ? currentYear + 1 : currentYear

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: uuid(),
    type: 'EXPENSE',
    date: `${currentYear}-${currentMonth}-01`,
    referenceMonth: `${currentYear}-${currentMonth}`,
    description: '',
    amount: 0,
    category: 'Other',
    paymentMethod: 'DEBIT',
    isDebt: false,
    isSettled: false,
    ...overrides,
  }
}

export function generateSeed(): FinanceData {
  const transactions: Transaction[] = [
    // === INCOME ===
    tx({
      type: 'INCOME',
      date: `${currentYear}-${currentMonth}-05`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Salary',
      amount: 5000,
      category: 'Salary',
      paymentMethod: 'DEBIT',
    }),
    tx({
      type: 'INCOME',
      date: `${currentYear}-${currentMonth}-05`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Meal Voucher',
      amount: 800,
      category: 'Salary',
      paymentMethod: 'MEAL_VOUCHER',
    }),

    // === EXPENSES - July ===
    tx({
      date: `${currentYear}-${currentMonth}-03`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Rent',
      amount: 1200,
      category: 'Rent',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-02`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Supermarket',
      amount: 350,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-08`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Supermarket',
      amount: 120,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-15`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Supermarket',
      amount: 200,
      category: 'Food',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-22`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Supermarket',
      amount: 180,
      category: 'Food',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-04`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Bus pass',
      amount: 50,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-10`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Gas',
      amount: 35,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-17`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Gas',
      amount: 40,
      category: 'Transport',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-23`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Uber',
      amount: 25,
      category: 'Transport',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-06`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Dinner out',
      amount: 150,
      category: 'Leisure',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-13`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Cinema',
      amount: 80,
      category: 'Leisure',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-20`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Restaurant',
      amount: 200,
      category: 'Leisure',
      paymentMethod: 'CREDIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-10`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Electricity bill',
      amount: 150,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-15`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Water bill',
      amount: 80,
      category: 'Utilities',
      paymentMethod: 'PIX',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-12`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Pharmacy',
      amount: 200,
      category: 'Health',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-18`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Clothes',
      amount: 350,
      category: 'Shopping',
      paymentMethod: 'CREDIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-25`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Online course',
      amount: 180,
      category: 'Education',
      paymentMethod: 'DEBIT',
    }),
    tx({
      date: `${currentYear}-${currentMonth}-28`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Internet',
      amount: 120,
      category: 'Utilities',
      paymentMethod: 'DEBIT',
    }),

    // === DEBT ===
    tx({
      date: `${currentYear}-${currentMonth}-20`,
      referenceMonth: `${currentYear}-${currentMonth}`,
      description: 'Loan to João',
      amount: 200,
      category: 'Other',
      paymentMethod: 'PIX',
      isDebt: true,
      debtorName: 'João',
      debtSplits: [{ debtorName: 'João', amount: 200 }],
      isSettled: false,
    }),

    // === CREDIT INSTALLMENT: TV 12x R$300 ===
    ...(() => {
      const installmentGroupId = uuid()
      const installments: Transaction[] = []
      for (let i = 1; i <= 12; i++) {
        const refMonthNum = now.getMonth() + 1 + i
        const refY = currentYear + Math.floor((refMonthNum - 1) / 12)
        const refM = String(((refMonthNum - 1) % 12) + 1).padStart(2, '0')
        installments.push(
          tx({
            date: `${currentYear}-${currentMonth}-15`,
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
      referenceMonth: `${currentYear}-${currentMonth}`,
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
