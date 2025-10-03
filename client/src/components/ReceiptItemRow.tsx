import type { ParsedItem } from './types'

type Props = {
  item: ParsedItem
  budgetOptions: string[]
  onChange: (id: string, patch: Partial<ParsedItem>) => void
}

export default function ReceiptItemRow({ item, budgetOptions, onChange }: Props) {
  return (
    <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="font-semibold text-gray-100">{item.name}</div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-sm text-gray-300">We think this is</label>
            <div className="mt-1 w-full h-10 bg-gray-800/20 border border-gray-700 rounded px-3 flex items-center text-gray-300 cursor-default select-none">{item.kind || 'Unknown'}</div>
          </div>

          <div>
            <label className="text-sm text-gray-300">Budget Category <strong>(select one)</strong></label>
            <div className="relative">
              <select
                className="mt-1 w-full h-10 bg-transparent border border-gray-600 rounded px-3 pr-9 text-gray-100 appearance-none cursor-pointer transition-colors duration-150 hover:border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                value={item.budgetCategory}
                onChange={(e) => onChange(item.id, { budgetCategory: e.target.value })}
              >
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
        </div>
      </div>
    </div>
  )
}
