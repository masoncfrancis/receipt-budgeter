import { useState, type ChangeEvent } from 'react'
import type { ParsedItem, MockResponse } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

const MOCK_BUDGETS = ['groceries', 'transport', 'entertainment', 'utilities', 'dining', 'other']

const mockApiExtract = async (file: File | null): Promise<MockResponse> => {
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setItems(null)
  }

  const onSubmit = async () => {
    setLoading(true)
    try {
      const res = await mockApiExtract(file)
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
    <div className="flex flex-col gap-4 items-center">
      <div className="w-full bg-gradient-to-br from-gray-800/60 via-gray-900/60 to-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <label className="block text-sm font-medium text-gray-200">Receipt Image</label>
          <input className="w-full text-sm text-gray-200 bg-transparent border border-gray-700 rounded px-3 py-2" type="file" accept="image/*" onChange={onFileChange} />

          <button
            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-md shadow-md disabled:opacity-60"
            onClick={onSubmit}
            disabled={!file || loading}
          >
            {loading ? 'Processing...' : 'Process Receipt'}
          </button>

          {previewUrl && (
            <div className="mt-3 w-full text-center">
              <div className="text-sm text-gray-300 mb-2">Preview</div>
              <div className="flex justify-center">
                <img src={previewUrl} alt="preview" className="w-full max-w-xs max-h-56 object-contain rounded border border-gray-700" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        {!items && (
          <div className="text-sm text-gray-300">No extracted items yet. Upload a receipt and tap "Process Receipt".</div>
        )}

        {items && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white">Extracted Items</h2>
              <div className="text-sm text-gray-400">Edit kind or budget before saving.</div>
            </div>

            <div className="flex flex-col gap-3">
              {items.map((it) => (
                <ReceiptItemRow key={it.id} item={it} budgetOptions={MOCK_BUDGETS} onChange={handleItemChange} />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-700 text-gray-200 bg-transparent"
                onClick={() => setItems(null)}
              >
                Reset
              </button>
              <button className="w-full sm:w-auto px-4 py-2 rounded-md bg-emerald-500 text-white font-semibold shadow" onClick={handleSave}>
                Save to Budget
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
