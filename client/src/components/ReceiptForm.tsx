import { useState, type ChangeEvent, useEffect } from 'react'
import { useOidc } from '../oidc'
import type { ParsedItem, Category, Account, BudgetInformationResponse, AnalyzeReceiptResponse } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

export default function ReceiptForm() {
  const { decodedIdToken, isUserLoggedIn } = useOidc({ assert: 'user logged in' })
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [accountId, setAccountId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'upload' | 'results'>('upload')
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgetInfoLoading, setBudgetInfoLoading] = useState<boolean>(true)

  useEffect(() => {
    const fetchBudgetInformation = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/getBudgetInformation`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: BudgetInformationResponse = await response.json()
        setAvailableCategories(data.availableCategories)
        setAccounts(data.accounts)
      } catch (error) {
        console.error('Failed to fetch budget information:', error)
        // Optionally, set an error state to display to the user
      } finally {
        setBudgetInfoLoading(false)
      }
    }

    fetchBudgetInformation()
  }, [])

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setFile(f)
    setItems(null)
  }

  const onSubmit = async () => {
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${BACKEND_URL}/analyzeReceipt`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AnalyzeReceiptResponse = await response.json()
      const parsedItems: ParsedItem[] = data.items.map((item) => ({
        id: item.itemId,
        name: item.itemName,
        kind: item.itemKind,
        budgetCategory: item.budgetCategoryId,
        budgetCategoryName: item.budgetCategoryName,
        price: item.price,
        manual: false,
      }))
      setItems(parsedItems)
      setView('results')
    } catch (error) {
      console.error('Failed to analyze receipt:', error)
      // Optionally, set an error state to display to the user
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (id: string, patch: Partial<ParsedItem>) => {
    if (!items) return
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const handleAddItem = () => {
    const newItem: ParsedItem = { id: uuidv4(), name: '', kind: '', budgetCategory: '', budgetCategoryName: '', price: undefined, manual: true }
    setItems((prev) => (prev ? [...prev, newItem] : [newItem]))
  }

  const handleRemoveItem = (id: string) => {
    if (!items) return
    const next = items.filter((it) => it.id !== id)
    setItems(next.length > 0 ? next : null)
  }

  const handleSave = () => {
    // For now just log the final payload — in real app we'd POST this to server
    const payload = { accountId: accountId || null, items }
    console.log('Saving receipt', payload)
    alert(`Receipt saved (mock). Account: ${accountId || 'not selected'}. Check console for payload.`)
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
                      disabled={!file || loading || budgetInfoLoading}
                    >
                      {loading || budgetInfoLoading ? (
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
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-800 text-sm mb-4"
                    >
                      <option value="" disabled selected>Select account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {items?.map((it) => (
                    <div key={it.id} className="p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg">
                      <ReceiptItemRow item={it} budgetOptions={availableCategories} onChange={handleItemChange} onRemove={handleRemoveItem} />
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
