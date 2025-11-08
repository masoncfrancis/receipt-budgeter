import { useEffect, useState, type ChangeEvent } from 'react'
import { useOidc } from '../oidc'
import type { ParsedItem } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

type BudgetInfo = {
  availableCategories: { id: string; name: string }[]
  accounts: { id: string; name: string }[]
}

// Keep a small client-side fallback in case backend isn't running
const FALLBACK_BUDGETS = ['groceries', 'transport', 'entertainment', 'utilities', 'dining', 'other']

export default function ReceiptForm() {
  const { decodedIdToken, isUserLoggedIn } = useOidc({ assert: 'user logged in' })
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'upload' | 'results'>('upload')

  // Budget options and payment/account options come from the API
  const [budgetOptions, setBudgetOptions] = useState<string[]>(FALLBACK_BUDGETS)
  const [paymentOptions, setPaymentOptions] = useState<string[]>(['Cash'])
  // Receipt-level metadata returned by analyzeReceipt
  const [receiptData, setReceiptData] = useState<{
    subtotal?: number
    tax?: number
    total?: number
    storeName?: string
    storeLocation?: string
  } | null>(null)

  // Fetch budget information when user is logged in
  useEffect(() => {
    if (!isUserLoggedIn) return

    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/getBudgetInformation')
        if (!res.ok) throw new Error(`unexpected status ${res.status}`)
        const json: BudgetInfo = await res.json()
        if (!mounted) return
        // Map categories to simple strings for the select
        const cats = json.availableCategories && json.availableCategories.length > 0
          ? json.availableCategories.map((c) => c.name)
          : FALLBACK_BUDGETS
        setBudgetOptions(cats)

        const pays = json.accounts && json.accounts.length > 0
          ? json.accounts.map((a) => `${a.name} (${a.id})`)
          : ['Cash']
        setPaymentOptions(pays)
      } catch (err) {
        // On any failure, keep the fallback lists
        // Optionally log to console for debugging
        // eslint-disable-next-line no-console
        console.warn('Failed to load budget information, using fallbacks', err)
        setBudgetOptions(FALLBACK_BUDGETS)
        setPaymentOptions(['Cash'])
      }
    })()
    return () => { mounted = false }
  }, [isUserLoggedIn])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setItems(null)
  }

  // POST multipart/form-data to /analyzeReceipt
  const analyzeReceipt = async (fileToSend: File | null): Promise<ParsedItem[]> => {
    if (!fileToSend) return []
    const fd = new FormData()
    fd.append('file', fileToSend)

    const res = await fetch('/analyzeReceipt', { method: 'POST', body: fd })
    if (!res.ok) {
      throw new Error(`analysis failed: ${res.status}`)
    }

    const json = await res.json()
    // Server conforms to AnalyzeReceiptResponse: { receiptData, items }
    const serverItems: any[] = Array.isArray(json.items) ? json.items : []
    const serverReceipt = json.receiptData ?? {}

    // Map receipt-level metadata into state
    setReceiptData({
      subtotal: typeof serverReceipt.subtotal === 'number' ? serverReceipt.subtotal : undefined,
      tax: typeof serverReceipt.tax === 'number' ? serverReceipt.tax : undefined,
      total: typeof serverReceipt.total === 'number' ? serverReceipt.total : undefined,
      storeName: serverReceipt.storeName ?? serverReceipt.store_name ?? undefined,
      storeLocation: serverReceipt.storeLocation ?? serverReceipt.store_location ?? undefined,
    })

    // Map server items to ParsedItem[]; be defensive about missing fields
    const mapped: ParsedItem[] = serverItems.map((it) => ({
      id: it.itemId ?? uuidv4(),
      name: it.itemName ?? it.name ?? 'Unnamed item',
      kind: it.itemKind ?? it.kind,
      budgetCategory: it.budgetCategoryName ?? it.budgetCategoryId ?? '',
      price: typeof it.price === 'number' ? it.price : (typeof it.amount === 'number' ? it.amount : undefined),
      manual: false,
    }))

    // If server returned nothing, fallback to a small mock so UI can still be exercised
    if (mapped.length === 0) {
      // Also set a mock receiptData so the UI shows totals during dev
      setReceiptData({ subtotal: 5.49, tax: 0.5, total: 5.99, storeName: 'Demo Grocery', storeLocation: '123 Example St' })
      return [
        { id: uuidv4(), name: 'Sample Item', kind: 'misc', budgetCategory: FALLBACK_BUDGETS[0], price: 1.0, manual: false },
      ]
    }

    return mapped
  }

  const onSubmit = async () => {
    setLoading(true)
    try {
      const res = await analyzeReceipt(file)
      setItems(res)
      // If receiptData wasn't set by analyzeReceipt (shouldn't happen), set a small fallback
      if (!receiptData) {
        setReceiptData({ subtotal: res.reduce((s, r) => s + (r.price ?? 0), 0), tax: undefined, total: undefined })
      }
      setView('results')
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Receipt analysis failed', err)
      alert('Failed to analyze receipt. Please try again or use the mock fallback.')
      // leave items as null so user can retry
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (id: string, patch: Partial<ParsedItem>) => {
    if (!items) return
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const handleAddItem = () => {
    const newItem: ParsedItem = { id: uuidv4(), name: '', kind: '', budgetCategory: '', price: undefined, manual: true }
    setItems((prev) => (prev ? [...prev, newItem] : [newItem]))
  }

  const handleRemoveItem = (id: string) => {
    if (!items) return
    const next = items.filter((it) => it.id !== id)
    setItems(next.length > 0 ? next : null)
  }

  const handleSave = () => {
    // For now just log the final payload — in real app we'd POST this to server
    const payload = { paymentMethod: paymentMethod || null, items }
    // eslint-disable-next-line no-console
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
            {view === 'upload' ? (
              <>
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

                <div className="flex items-center justify-center">
                  <div className="w-full max-w-xl flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                      onClick={() => { setFile(null); setItems(null) }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
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
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1 mb-2 text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Here's what we found</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-300">Tell us the budget category for each item. We gave our best guess — please check.</div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="w-full max-w-md">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Payment method for this receipt</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-800 text-sm mb-4"
                    >
                      <option value="">Select payment</option>
                      {paymentOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Receipt summary: subtotal / tax / total and store info */}
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Store</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{receiptData?.storeName ?? 'Unknown store'}</div>
                      {receiptData?.storeLocation && <div className="text-sm text-gray-500">{receiptData?.storeLocation}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Subtotal</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{typeof receiptData?.subtotal === 'number' ? `$${receiptData.subtotal.toFixed(2)}` : '—'}</div>
                      <div className="text-sm text-gray-500 mt-1">Tax</div>
                      <div className="text-sm text-gray-700">{typeof receiptData?.tax === 'number' ? `$${receiptData.tax.toFixed(2)}` : '—'}</div>
                      <div className="text-sm text-gray-500 mt-1">Total</div>
                      <div className="font-bold text-gray-900 dark:text-white">{typeof receiptData?.total === 'number' ? `$${receiptData.total.toFixed(2)}` : (typeof receiptData?.subtotal === 'number' ? `$${receiptData.subtotal.toFixed(2)}` : '—')}</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {items?.map((it) => (
                    <div key={it.id} className="p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg">
                      <ReceiptItemRow item={it} budgetOptions={budgetOptions} onChange={handleItemChange} onRemove={handleRemoveItem} />
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-600 text-sm text-gray-800 dark:text-gray-100"
                      onClick={handleAddItem}
                    >
                      + Add item
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center mt-2">
                  <div className="w-full max-w-lg flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                      onClick={() => { setItems(null); setFile(null); setView('upload') }}
                    >
                      Back
                    </button>
                    <button className="flex-1 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow" onClick={handleSave}>
                      Save to Budget
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
