'use client'

import { DollarSign, Plus, TrendingUp, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PremiumGate } from '@/components/premium/premium-gate'
import { cn } from '@/lib/utils'

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  date: string
}

const CATEGORIES = [
  'Accommodation',
  'Food & Dining',
  'Transportation',
  'Activities',
  'Shopping',
  'Other',
]

interface BudgetTrackerProps {
  tripId?: string
  budget?: number
}

export function BudgetTracker({ tripId, budget: initialBudget = 0 }: BudgetTrackerProps) {
  const [budget, setBudget] = useState(initialBudget)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: CATEGORIES[0] })

  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const remaining = budget - totalSpent
  const percentageSpent = budget > 0 ? (totalSpent / budget) * 100 : 0

  const addExpense = () => {
    if (!newExpense.description.trim() || !newExpense.amount) return

    setExpenses([
      ...expenses,
      {
        id: Date.now().toString(),
        description: newExpense.description.trim(),
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        date: new Date().toISOString(),
      },
    ])
    setNewExpense({ description: '', amount: '', category: CATEGORIES[0] })
  }

  const expensesByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = expenses.filter(exp => exp.category === category).reduce((sum, exp) => sum + exp.amount, 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <PremiumGate feature="Budget tracker">
      <div className="content-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[rgb(var(--accent))]" />
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Budget Tracker</h3>
        </div>

        <div className="space-y-4">
          {/* Budget Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
              Total Budget
            </label>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-[rgb(var(--text))]">$</span>
              <Input
                type="number"
                value={budget || ''}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                className="input-surface flex-1"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Budget Overview */}
          {budget > 0 && (
            <div className="space-y-3 p-4 rounded-xl border border-[rgb(var(--border))]/30 bg-[rgb(var(--surface-muted))]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                  Spent
                </span>
                <span className="text-lg font-bold text-[rgb(var(--text))]">${totalSpent.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-[rgb(var(--surface-muted))]/50 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    percentageSpent > 100 ? 'bg-[rgb(var(--error))]' : 'bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--accent-secondary))]'
                  )}
                  style={{ width: `${Math.min(percentageSpent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
                  Remaining
                </span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    remaining < 0 ? 'text-[rgb(var(--error))]' : 'text-[rgb(var(--success))]'
                  )}
                >
                  ${remaining.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Expenses List */}
          {expenses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] uppercase tracking-wider">
                Expenses
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {expenses.map(expense => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-[rgb(var(--border))]/30 bg-[rgb(var(--surface-muted))]/30"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[rgb(var(--text))]">{expense.description}</p>
                      <p className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)]">
                        {expense.category}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[rgb(var(--text))]">${expense.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Expense */}
          <div className="space-y-2 pt-2 border-t border-[rgb(var(--border))]/30">
            <h4 className="text-xs font-semibold text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] uppercase tracking-wider">
              Add Expense
            </h4>
            <div className="flex gap-2">
              <Input
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="Description"
                className="input-surface flex-1"
              />
              <Input
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="Amount"
                className="input-surface w-24"
              />
            </div>
            <select
              value={newExpense.category}
              onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
              className="input-surface w-full text-sm"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <Button onClick={addExpense} className="btn btn-primary w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>
      </div>
    </PremiumGate>
  )
}
