import { useState } from 'react'
import type { ParsedItem } from './types'

type Props = {
  item: ParsedItem
  budgetOptions: string[]
  onChange: (id: string, patch: Partial<ParsedItem>) => void
  onRemove?: (id: string) => void
}

export default function ReceiptItemRow({ item, budgetOptions, onChange, onRemove }: Props) {
  const [priceStr, setPriceStr] = useState<string>(() => (typeof item.price === 'number' ? item.price.toFixed(2) : ''))

  const commitPrice = () => {
    if (priceStr === '') {
      onChange(item.id, { price: undefined })
      return
    }
    const parsed = Number(priceStr)
    if (Number.isNaN(parsed)) return
    const rounded = Math.round(parsed * 100) / 100
    setPriceStr(rounded.toFixed(2))
    onChange(item.id, { price: rounded })
  }

  return (
    <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div className="w-full">
            {item.manual ? (
              <input
                type="text"
                className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-gray-100"
                placeholder="Item name"
                value={item.name}
                onChange={(e) => onChange(item.id, { name: e.target.value })}
              />
            ) : (
              <div className="font-semibold text-gray-100">{item.name || 'Unnamed item'}</div>
            )}
          </div>
          {onRemove && (
            <button
              type="button"
              aria-label="Remove item"
              className="text-lg text-red-500 hover:text-red-400 ml-2"
              onClick={() => onRemove(item.id)}
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {!item.manual && (
            <div>
              <label className="text-sm text-gray-300">We think this is</label>
              <div className="mt-1 w-full h-10 bg-gray-800/20 border border-gray-700 rounded px-3 flex items-center text-gray-300 cursor-default select-none">{item.kind || 'Unknown'}</div>
            </div>
          )}

          <div>
            <label className="text-sm text-gray-300">Budget Category <strong>(select one)</strong></label>
            <div className="relative">
              <select
                className="mt-1 w-full h-10 bg-transparent border border-gray-600 rounded px-3 pr-9 text-gray-100 appearance-none cursor-pointer transition-colors duration-150 hover:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={item.budgetCategory}
                onChange={(e) => onChange(item.id, { budgetCategory: e.target.value })}
              >
              <option value="" disabled className="bg-gray-800 text-gray-400">Please choose one...</option>
              {budgetOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-gray-800">
                  {opt}
                </option>
              ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 8l4 4 4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Price</label>
            <div className="mt-1">
              <input
                type="number"
                step="0.01"
                className="w-full h-10 bg-transparent border border-gray-600 rounded px-3 text-gray-100"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
