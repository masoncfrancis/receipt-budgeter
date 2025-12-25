import { useState, type ChangeEvent, useEffect, useMemo } from 'react'
import { useOidc } from '../oidc'
import type { ParsedItem, Category, Account, BudgetInformationResponse, AnalyzeReceiptResponse, ReceiptData } from './types'
import ReceiptItemRow from './ReceiptItemRow'
import { v4 as uuidv4 } from 'uuid'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

export default function ReceiptForm() {
  const { decodedIdToken, isUserLoggedIn } = useOidc({ assert: 'user logged in' })
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<ParsedItem[] | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [accountId, setAccountId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'upload' | 'results'>('upload')
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [budgetInfoLoading, setBudgetInfoLoading] = useState<boolean>(true)
  const [localTaxRates, setLocalTaxRates] = useState<Array<{ id: string; name?: string; description?: string; rate?: number | null; enabled?: boolean }>>([])
  const [newTaxName, setNewTaxName] = useState('')
  const [newTaxRateStr, setNewTaxRateStr] = useState('')
  const [showAddTaxInputs, setShowAddTaxInputs] = useState(false)

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
    setReceiptData(null)
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
      setReceiptData(data.receiptData)
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

  // Initialize local tax rates when receiptData changes
  useEffect(() => {
    if (receiptData && Array.isArray(receiptData.taxRates)) {
      const mapped = receiptData.taxRates.map((r) => ({ id: r.id, name: r.name, description: r.description, rate: typeof r.rate === 'number' ? r.rate : null, enabled: true }))
      setLocalTaxRates(mapped)
    } else {
      setLocalTaxRates([])
    }
  }, [receiptData])

  const addTaxRate = () => {
    if (!newTaxName) return
    const parsed = Number(newTaxRateStr)
    const rate = Number.isNaN(parsed) ? null : (parsed > 1 ? parsed / 100 : parsed)
    const t = { id: uuidv4(), name: newTaxName.trim(), description: undefined, rate, enabled: true }
    setLocalTaxRates((prev) => [...prev, t])
    setNewTaxName('')
    setNewTaxRateStr('')
    setShowAddTaxInputs(false)
  }

  const toggleRateEnabled = (id: string) => {
    setLocalTaxRates((prev) => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const removeTaxRate = (id: string) => {
    setLocalTaxRates((prev) => prev.filter(r => r.id !== id))
  }

  const totals = useMemo(() => {
    if (!items) return null;

    const subtotal = items.reduce((acc, item) => acc + (item.price || 0), 0);

    const rates = localTaxRates || [];

    // Build per-tax totals based on which taxes are applied to each item
    const taxTotalsById: Record<string, { id: string; name?: string; rate: number | null; total: number; enabled?: boolean }> = {};
    for (const r of rates) {
      taxTotalsById[r.id] = { id: r.id, name: r.name ?? r.description, rate: typeof r.rate === 'number' ? r.rate : null, total: 0, enabled: r.enabled !== false };
    }

    // Sum taxes applied on items (only for rates that have a numeric rate)
    let computedTax = 0;
    for (const it of items) {
      const applied = (it as any).taxesApplied || [];
      for (const tid of applied) {
        const tr = taxTotalsById[tid];
        if (tr) {
          if (tr.enabled !== false && typeof tr.rate === 'number' && typeof it.price === 'number') {
            const amt = Math.round(it.price * tr.rate * 100) / 100;
            tr.total += amt;
            computedTax += amt;
          }
        } else {
          // Unknown tax id — create an entry (rate unknown)
          if (!taxTotalsById[tid]) {
            taxTotalsById[tid] = { id: tid, name: tid, rate: null, total: 0 };
          }
        }
      }
    }

    // Receipt-provided tax amount (fallback to total - subtotal if explicit taxAmount missing)
    const receiptTaxAmount = typeof receiptData?.taxAmount === 'number'
      ? receiptData.taxAmount
      : (typeof receiptData?.total === 'number' && typeof receiptData?.subtotal === 'number')
        ? receiptData.total - receiptData.subtotal
        : null;

    // Receipt-provided subtotal (if available)
    const receiptSubtotal = typeof receiptData?.subtotal === 'number' ? receiptData.subtotal : null;

    const total = subtotal + computedTax;

    return { subtotal, taxTotalsById, computedTax, receiptTaxAmount, receiptSubtotal, total };
  }, [items, receiptData, localTaxRates]);

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
                <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                <div className="flex flex-col items-center gap-1 mb-2 text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Your Receipt</h2>
                  <div className="border border-gray-200 dark:border-orange-300 rounded-lg p-4 mb-4"><div className="text-sm text-gray-500 dark:text-gray-300"><strong>Remember:</strong> AI was used to figure out what's on your receipt, so the results could be incorrect. Please double-check before submitting.</div></div>
                  
                </div>

                

                                {receiptData && (

                                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">

                                    <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2 text-center"><u>Merchant Info</u></h3>

                                    <div className="text-center">

                                      <p className="text-md font-semibold text-gray-900 dark:text-white">{receiptData.storeName}</p>

                                      <p className="text-sm text-gray-500 dark:text-gray-300">{receiptData.storeLocation}</p>

                                    </div>

                                  </div>

                                )}

                  {/* Tax management: list and add rates */}
                  <div>
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4">
                      <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Sales Taxes</h3>
                      <div className="flex flex-col gap-2">
                        {localTaxRates.length === 0 ? (
                          <div className="text-sm text-gray-500">No tax rates detected.</div>
                        ) : (
                          localTaxRates.map((tr) => (
                            <div key={tr.id} className="flex items-center justify-between">
                              <div className="text-sm text-gray-700 dark:text-gray-200">
                                <strong className="mr-2">{tr.name}</strong>
                                {typeof tr.rate === 'number' ? <span className="text-gray-500">({(tr.rate * 100).toFixed(2)}%)</span> : <span className="text-gray-500">(rate unknown)</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="inline-flex items-center text-sm text-gray-600 dark:text-gray-300">
                                  <input type="checkbox" checked={tr.enabled ?? true} onChange={() => toggleRateEnabled(tr.id)} className="mr-2" />
                                </label>
                                <button type="button" onClick={() => removeTaxRate(tr.id)} title="Remove tax" aria-label="Remove tax" className="text-xl text-red-500 hover:text-red-400">✕</button>
                              </div>
                            </div>
                          ))
                        )}

                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                          {!showAddTaxInputs ? (
                            <div className="flex justify-end">
                              <button type="button" onClick={() => setShowAddTaxInputs(true)} className="px-3 py-2 rounded-md bg-blue-600 text-white" aria-label="Add tax rate" title="Add tax rate">+</button>
                            </div>
                          ) : (
                            <div>
                              <div className="flex gap-2">
                                <input value={newTaxName} onChange={(e) => setNewTaxName(e.target.value)} placeholder="Tax name (e.g. State Sales)" className="flex-1 rounded-md border p-2 bg-white dark:bg-gray-800 text-sm" />
                                <input value={newTaxRateStr} onChange={(e) => setNewTaxRateStr(e.target.value)} placeholder="Rate % (e.g. 7)" className="w-28 rounded-md border p-2 bg-white dark:bg-gray-800 text-sm" />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">Enter a percentage (e.g. <em>7</em> for 7%) or a decimal (<em>0.07</em>).</div>
                              <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={addTaxRate} className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white" aria-label="Confirm add tax" title="Confirm">✓</button>
                                <button type="button" onClick={() => { setShowAddTaxInputs(false); setNewTaxName(''); setNewTaxRateStr('') }} className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white" aria-label="Cancel add tax" title="Cancel">✕</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                <div className="flex items-center justify-center">
                  <div className="w-full max-w-md">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Payment method for this receipt</label>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 bg-white dark:bg-gray-800 text-sm mb-4"
                    >
                      <option value="" disabled selected>Select account...</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {items?.map((it) => (
                    <div key={it.id} className="p-4 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg">
                      <ReceiptItemRow item={it} budgetOptions={availableCategories} onChange={handleItemChange} onRemove={handleRemoveItem} taxRates={localTaxRates} />
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

                  {totals && (
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-600 pt-4">
                    <div className="flex justify-end items-center text-right">
                      <div className="w-full max-w-xs">
                        <div className="flex justify-between py-1">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Subtotal</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">${totals.subtotal.toFixed(2)}</span>
                        </div>

                        {/* Per-tax breakdown computed from applied taxes on items */}
                        {Object.values(totals.taxTotalsById).map((tr) => (
                          <div key={tr.id} className="flex justify-between py-1">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{tr.name ?? tr.id}{tr.rate !== null ? ` (${(tr.rate * 100).toFixed(2)}%)` : ' (estimated)'}</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">${tr.total.toFixed(2)}</span>
                          </div>
                        ))}

                        <div className="flex justify-between py-1 border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                          <span className="text-base font-bold text-gray-900 dark:text-white">Total</span>
                          <span className="text-base font-bold text-gray-900 dark:text-white">${totals.total.toFixed(2)}</span>
                        </div>

                        {totals.receiptTaxAmount !== null && (
                          <div className="mt-2 text-sm text-gray-500">Receipt tax amount: <span className="font-medium text-gray-900 dark:text-white">${totals.receiptTaxAmount.toFixed(2)}</span></div>
                        )}

                        {totals.receiptTaxAmount !== null && Math.abs((totals.computedTax || 0) - totals.receiptTaxAmount) > 0.01 && (
                          <div className="mt-2 text-sm text-red-500">Tax mismatch: computed <strong>${(totals.computedTax || 0).toFixed(2)}</strong> vs receipt <strong>${totals.receiptTaxAmount.toFixed(2)}</strong> (diff <strong>${((totals.computedTax || 0) - totals.receiptTaxAmount).toFixed(2)}</strong>)</div>
                        )}

                        {totals.receiptSubtotal !== null && Math.abs(totals.subtotal - totals.receiptSubtotal) > 0.01 && (
                          <div className="mt-2 text-sm text-red-500">Subtotal mismatch: computed <strong>${totals.subtotal.toFixed(2)}</strong> vs receipt <strong>${totals.receiptSubtotal.toFixed(2)}</strong> (diff <strong>${(totals.subtotal - totals.receiptSubtotal).toFixed(2)}</strong>)</div>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  
                </div>

                <div className="flex items-center justify-center mt-2">
                  <div className="w-full max-w-lg flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                      onClick={() => { setItems(null); setFile(null); setReceiptData(null); setView('upload') }}
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
