import { useState, type ChangeEvent } from 'react'
import type { ParsedItem, MockResponse } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

const MOCK_BUDGETS = ['groceries', 'transport', 'entertainment', 'utilities', 'dining', 'other']

// Mock API that finds items on a receipt (friendly wording)
const mockApiFind = async (_file: File | null): Promise<MockResponse> => {
  // Simulate an OCR/API call delay
  await new Promise((r) => setTimeout(r, 700))

    // Return deterministic mock data for UI testing
  return [
    { id: uuidv4(), name: 'Whole Wheat Bread', kind: 'bread', budgetCategory: 'groceries' },
    { id: uuidv4(), name: '2% Milk 1L', kind: 'milk', budgetCategory: 'groceries' },
    { id: uuidv4(), name: 'Chocolate Bar', kind: 'snack', budgetCategory: 'dining' },
  ]
}

export default function ReceiptForm() {
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setItems(null)
  }

  const onSubmit = async () => {
    setLoading(true)
    try {
      const res = await mockApiFind(file)
      setItems(res)
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (id: string, patch: Partial<ParsedItem>) => {
    if (!items) return
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const handleSave = () => {
    // For now just log the final payload — in real app we'd POST this to server
    console.log('Saving items', items)
    alert('Items saved (mock). Check console for payload.')
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Track Receipts</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Upload a photo of your receipt and we'll help you put it in the budget</p>
          </div>

          <div className="space-y-6">
            {/* File input card */}
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Receipt Photo <span className="text-red-500">*</span></label>
              <div className="relative rounded-md overflow-hidden border border-dashed border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-6 text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Click or drag a file to upload</div>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => { /* noop; input overlay handles click */ }}
                      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                      Choose file
                    </button>
                    {file && <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs">{file.name}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-lg flex flex-col sm:flex-row gap-3">
                <button
                  className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                  onClick={() => { setFile(null); setItems(null) }}
                >
                  Reset
                </button>
                <button
                  className="flex-1 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
                  onClick={onSubmit}
                  disabled={!file || loading}
                >
                  {loading ? 'Looking at your receipt...' : 'Check the Receipt'}
                </button>
              </div>
            </div>

            {/* Items found */}
            <div>
              

              {items && (
                <div className="space-y-4">
                  <div className="flex flex-col items-start gap-1 mb-2">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Items found</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">Choose a category for each item before saving. We gave our best guess — please check.</div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {items.map((it) => (
                      <div key={it.id} className="p-3 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg">
                        <ReceiptItemRow item={it} budgetOptions={MOCK_BUDGETS} onChange={handleItemChange} />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center mt-2">
                    <div className="w-full max-w-md flex flex-col sm:flex-row gap-3">
                      <button
                        className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                        onClick={() => setItems(null)}
                      >
                        Reset
                      </button>
                      <button className="flex-1 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow" onClick={handleSave}>
                        Save to Budget
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
