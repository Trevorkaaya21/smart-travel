'use client'

import { Check, Plus, Luggage } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PackingItem {
  id: string
  name: string
  category: string
  checked: boolean
}

const DEFAULT_CATEGORIES = [
  'Clothing',
  'Electronics',
  'Toiletries',
  'Documents',
  'Accessories',
  'Other',
]

const SUGGESTED_ITEMS = {
  Clothing: ['T-shirts', 'Pants', 'Underwear', 'Socks', 'Jacket', 'Shoes'],
  Electronics: ['Phone', 'Charger', 'Power bank', 'Camera', 'Laptop'],
  Toiletries: ['Toothbrush', 'Toothpaste', 'Shampoo', 'Soap', 'Sunscreen'],
  Documents: ['Passport', 'ID', 'Travel insurance', 'Tickets', 'Hotel confirmations'],
  Accessories: ['Sunglasses', 'Hat', 'Backpack', 'Water bottle'],
}

let packingItemId = 0
const nextPackingItemId = () => `packing-${packingItemId++}`

interface PackingListProps {
  tripId?: string
  days?: number
}

export function PackingList({ tripId: _tripId, days = 3 }: PackingListProps) {
  const [items, setItems] = useState<PackingItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_CATEGORIES[0])
  const [showSuggestions, setShowSuggestions] = useState(true)

  const addItem = (name: string, category: string) => {
    if (!name.trim()) return
    setItems([
      ...items,
      {
        id: nextPackingItemId(),
        name: name.trim(),
        category,
        checked: false,
      },
    ])
    setNewItem('')
  }

  const toggleItem = (id: string) => {
    setItems(items.map(item => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const addSuggestedItems = (category: string) => {
    const suggested = SUGGESTED_ITEMS[category as keyof typeof SUGGESTED_ITEMS] || []
    suggested.forEach(item => {
      if (!items.some(i => i.name.toLowerCase() === item.toLowerCase())) {
        addItem(item, category)
      }
    })
    setShowSuggestions(false)
  }

  const itemsByCategory = DEFAULT_CATEGORIES.reduce((acc, category) => {
    acc[category] = items.filter(item => item.category === category)
    return acc
  }, {} as Record<string, PackingItem[]>)

  const totalItems = items.length
  const checkedItems = items.filter(item => item.checked).length
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0

  return (
    <div className="content-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Luggage className="h-5 w-5 text-[rgb(var(--accent))]" />
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Packing List</h3>
        </div>
        {totalItems > 0 && (
          <span className="text-xs font-medium text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)]">
            {checkedItems}/{totalItems}
          </span>
        )}
      </div>

      {totalItems > 0 && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-[rgb(var(--surface-muted))]/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent-secondary)))',
              }}
            />
          </div>
        </div>
      )}

      {showSuggestions && items.length === 0 && (
        <div className="mb-4 p-4 rounded-xl border border-[rgb(var(--border))]/30 bg-[rgb(var(--surface-muted))]/30">
          <p className="text-xs font-medium text-[rgb(var(--text))] mb-3">Quick add for {days} day trip:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.slice(0, 4).map(category => (
              <button
                key={category}
                onClick={() => addSuggestedItems(category)}
                className="btn btn-ghost text-xs px-3 py-1.5"
              >
                Add {category}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {DEFAULT_CATEGORIES.map(category => {
          const categoryItems = itemsByCategory[category] || []
          if (categoryItems.length === 0 && items.length > 0) return null

          return (
            <div key={category}>
              <h4 className="text-xs font-semibold text-[color-mix(in_oklab,rgb(var(--text))_70%,rgb(var(--muted))_30%)] mb-2 uppercase tracking-wider">
                {category}
              </h4>
              <div className="space-y-2">
                {categoryItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-[rgb(var(--border))]/30 bg-[rgb(var(--surface-muted))]/30 hover:bg-[rgb(var(--surface-muted))]/50 transition-colors"
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        'flex items-center justify-center w-5 h-5 rounded border-2 transition-all',
                        item.checked
                          ? 'bg-[rgb(var(--success))] border-[rgb(var(--success))]'
                          : 'border-[rgb(var(--border))]'
                      )}
                    >
                      {item.checked && <Check className="h-3 w-3 text-white" />}
                    </button>
                    <span
                      className={cn(
                        'flex-1 text-sm',
                        item.checked && 'line-through text-[color-mix(in_oklab,rgb(var(--text))_50%,rgb(var(--muted))_50%)]'
                      )}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-[color-mix(in_oklab,rgb(var(--text))_60%,rgb(var(--muted))_40%)] hover:text-[rgb(var(--error))]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex gap-2 pt-2 border-t border-[rgb(var(--border))]/30">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addItem(newItem, selectedCategory)
              }
            }}
            placeholder="Add item..."
            className="input-surface flex-1"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-surface w-32 text-sm"
          >
            {DEFAULT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <Button
            onClick={() => addItem(newItem, selectedCategory)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
