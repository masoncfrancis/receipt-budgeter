import { useState, type ChangeEvent } from 'react'
import { useOidc } from '../oidc'
import type { ParsedItem, MockResponse } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

const MOCK_BUDGETS = ['groceries', 'transport', 'entertainment', 'utilities', 'dining', 'other']

// Placeholder payment methods for the whole receipt (will come from backend later)
const PAYMENT_OPTIONS = ['Visa **** 1234', 'Mastercard **** 5678', 'Cash', 'Amex **** 9012', 'Other']

// Mock API that finds items on a receipt (friendly wording)
const mockApiFind = async (_file: File | null): Promise<MockResponse> => {
  // Simulate an OCR/API call delay
  await new Promise((r) => setTimeout(r, 700))

    // Return deterministic mock data for UI testing
  return [
    { id: uuidv4(), name: 'Whole Wheat Bread', kind: 'bread', budgetCategory: 'groceries', price: 2.49 },
    { id: uuidv4(), name: '2% Milk 1L', kind: 'milk', budgetCategory: 'groceries', price: 3.19 },
    { id: uuidv4(), name: 'Chocolate Bar', kind: 'snack', budgetCategory: 'dining', price: 1.5 },
  ]
}

export default function ReceiptForm() {
  const { decodedIdToken, isUserLoggedIn } = useOidc({ assert: 'user logged in' })
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
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
    const payload = { paymentMethod: paymentMethod || null, items }
    console.log('Saving receipt', payload)
    alert(`Receipt saved (mock). Payment: ${paymentMethod || 'not selected'}. Check console for payload.`)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
  <div className="w-full max-w-3xl">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
          {isUserLoggedIn && decodedIdToken && (
            <div className="flex justify-end items-center mb-4">
              <span className="px-3 py-1 rounded-lg border-1 font-semibold text-sm transition-colors duration-300 text-gray-800 dark:text-white">
                {decodedIdToken.name ?? decodedIdToken.preferred_username ?? 'User'}
              </span>
            </div>
          )}

          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Receipt Budgeter</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Upload a photo of your receipt and we'll help you put it in the budget</p>
          </div>

          <div className="space-y-8">
            {/* File input card */}
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Receipt Photo <span className="text-red-500">*</span></label>
              <div className="relative rounded-md overflow-hidden border border-dashed border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-800/40">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-6 text-center">
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { /* noop; input overlay handles click */ }}
                      className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                      Choose file
                    </button>
                    {file && (
                      <span className="mt-1 block px-3 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs text-center">{file.name}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-xl flex flex-col sm:flex-row gap-4">
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
                  {loading ? (
                    <span className="flex items-center justify-center" aria-hidden="true">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      <span className="sr-only">Processing</span>
                    </span>
                  ) : (
                    'Check the Receipt'
                  )}
                </button>
              </div>
            </div>

            {/* Items found */}
            <div>
              

              {items && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-1 mb-2 text-center">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Here's what we found</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">Tell us the budget category for each item. We gave our best guess — please check.</div>
                  </div>

                  {/* Receipt-level payment method selection */}
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-md">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Payment method for this receipt</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-800 text-sm mb-4"
                      >
                        <option value="">Select payment</option>
                        {PAYMENT_OPTIONS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                      {items.map((it) => (
                        <div key={it.id} className="p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg">
                        <ReceiptItemRow item={it} budgetOptions={MOCK_BUDGETS} onChange={handleItemChange} />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-center mt-2">
                    <div className="w-full max-w-lg flex flex-col sm:flex-row gap-4">
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
