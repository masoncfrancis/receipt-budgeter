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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-300">Kind</label>
            <input
              className="mt-1 w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-gray-100"
              value={item.kind}
              onChange={(e) => onChange(item.id, { kind: e.target.value })}
              placeholder="e.g., bread, milk"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Budget</label>
            <select
              className="mt-1 w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-gray-100"
              value={item.budgetCategory}
              onChange={(e) => onChange(item.id, { budgetCategory: e.target.value })}
            >
              {budgetOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-gray-800">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
