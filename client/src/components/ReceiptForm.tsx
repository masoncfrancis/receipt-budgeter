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
   const [createTransactions, setCreateTransactions] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
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

  const handleSave = async () => {
    if (!accountId) {
      alert('Please select an account before saving')
      return
    }

    // Aggregate splits from current items (include taxes applied)
    const categoryMap: Record<string, { id: string; name: string; amount: number }> = {}
    if (items) {
      for (const it of items) {
        const catId = (it as any).budgetCategory || 'uncategorized'
        const catName = (it as any).budgetCategoryName || catId
        const price = typeof it.price === 'number' ? it.price : 0
        // compute item tax using localTaxRates if any
        let itemTax = 0
        const applied = (it as any).taxesApplied || []
        for (const tid of applied) {
          const tr = localTaxRates.find((r) => r.id === tid)
          if (tr && typeof tr.rate === 'number' && tr.enabled !== false) {
            itemTax += Math.round(price * tr.rate * 100) / 100
          }
        }
        const totalForItem = price + itemTax
        if (!categoryMap[catId]) categoryMap[catId] = { id: catId, name: catName, amount: 0 }
        categoryMap[catId].amount += totalForItem
      }
    }

    const splits = Object.values(categoryMap).map((c) => ({ categoryId: c.id, amount: Math.round(c.amount * 100) / 100, description: c.name }))

    const payload: any = {
      accountId,
      merchantName: receiptData?.storeName || undefined,
      merchantLocation: receiptData?.storeLocation || undefined,
      subtotal: totals?.subtotal,
      tax: totals?.receiptTaxAmount ?? undefined,
      total: totals?.total,
      splits,
      createTransactions: createTransactions,
    }

    setSubmitError(null)
    try {
      const resp = await fetch(`${BACKEND_URL}/submitReceipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok) {
        console.error('Submit failed', data)
        setSubmitError(typeof data === 'string' ? data : (data.error || JSON.stringify(data)))
        return
      }
      console.log('Submit response', data)
      const successMsg = 'Receipt submitted: ' + (data.id || JSON.stringify(data))
      setSubmitSuccess(successMsg)
      setSubmitError(null)
      // reset view but keep success banner
      setItems(null)
      setFile(null)
      setReceiptData(null)
      setView('upload')
    } catch (err) {
      console.error('Submit error', err)
      setSubmitError(String(err))
    }
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

  // Auto-dismiss success message after a short delay
  useEffect(() => {
    if (!submitSuccess) return
    const t = setTimeout(() => setSubmitSuccess(null), 8000)
    return () => clearTimeout(t)
  }, [submitSuccess])

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

    // Compute per-category totals (including taxes applied to items)
    const categoryMap: Record<string, { id: string; name: string; subtotal: number; tax: number; total: number }> = {};
    const categoryNameForId = (id: string | undefined, fallback: string) => {
      if (!id) return fallback
      const cat = availableCategories.find((c) => c.id === id)
      return cat ? cat.name : fallback
    }

    for (const it of items) {
      const catId = (it as any).budgetCategory || 'uncategorized'
      const catName = categoryNameForId((it as any).budgetCategory, (it as any).budgetCategoryName || 'Uncategorized')
      if (!categoryMap[catId]) categoryMap[catId] = { id: catId, name: catName, subtotal: 0, tax: 0, total: 0 }
      const entry = categoryMap[catId]
      const price = typeof it.price === 'number' ? it.price : 0
      entry.subtotal += price

      // taxes applied to this item
      const applied = (it as any).taxesApplied || []
      let itemTax = 0
      for (const tid of applied) {
        const tr = taxTotalsById[tid]
        if (tr && tr.enabled !== false && typeof tr.rate === 'number') {
          const amt = Math.round(price * tr.rate * 100) / 100
          itemTax += amt
        }
      }
      entry.tax += itemTax
      entry.total += price + itemTax
    }

    const categoryTotals = Object.values(categoryMap)

    return { subtotal, taxTotalsById, computedTax, receiptTaxAmount, receiptSubtotal, total, categoryTotals };
  }, [items, receiptData, localTaxRates]);

  const [showCategoryTotals, setShowCategoryTotals] = useState(false)

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
                  {submitSuccess && (
                    <div className="mb-4 text-center">
                      <div className="inline-block bg-emerald-100 text-emerald-800 px-4 py-2 rounded-md">{submitSuccess}</div>
                    </div>
                  )}

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
                {showCategoryTotals && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowCategoryTotals(false)} />
                    <div className="relative bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl z-10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Totals (including tax)</h3>
                        <button onClick={() => setShowCategoryTotals(false)} className="text-gray-500 hover:text-gray-700">Close</button>
                      </div>
                      <div className="space-y-2">
                        {!(totals && totals.categoryTotals && totals.categoryTotals.length > 0) ? (
                          <div className="text-sm text-gray-500">No items to summarize.</div>
                        ) : (
                          <div className="overflow-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-600 dark:text-gray-300">
                                  <th className="pb-2">Category</th>
                                  <th className="pb-2 text-right">Subtotal</th>
                                  <th className="pb-2 text-right">Tax</th>
                                  <th className="pb-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(totals?.categoryTotals ?? []).map((c) => (
                                  <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                                    <td className="py-2 text-gray-800 dark:text-gray-200">{c.name}</td>
                                    <td className="py-2 text-right text-gray-700 dark:text-gray-300">${c.subtotal.toFixed(2)}</td>
                                    <td className="py-2 text-right text-gray-700 dark:text-gray-300">${c.tax.toFixed(2)}</td>
                                    <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">${c.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                  <div className="w-full max-w-lg flex justify-center">
                    <label className="inline-flex items-center text-sm text-gray-700 dark:text-gray-200">
                      <input type="checkbox" checked={createTransactions} onChange={(e) => setCreateTransactions(e.target.checked)} className="mr-2" />
                      Create transaction in budget
                    </label>
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center justify-center mt-2">
                    <div className="w-full max-w-lg text-sm text-red-500 text-center">{submitError}</div>
                  </div>
                )}

                <div className="flex items-center justify-center mt-2">
                  <div className="w-full max-w-lg flex flex-col sm:flex-row gap-4">
                    <button
                      type="button"
                      className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-transparent"
                      onClick={() => { setItems(null); setFile(null); setReceiptData(null); setView('upload') }}
                    >
                      Back
                    </button>
                    <button type="button" className="flex-1 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow" onClick={handleSave}>
                      Save to Budget
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-center mt-2">
                    <div className="w-full max-w-lg flex justify-center">
                    <button type="button" onClick={() => { console.log('toggle category totals'); setShowCategoryTotals((s) => !s) }} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-sm text-gray-800 dark:text-gray-100">Show Category Totals</button>
                  </div>
                </div>
                {showCategoryTotals && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Category totals (including tax)</h4>
                      <button onClick={() => setShowCategoryTotals(false)} className="text-xl text-red-500 hover:text-red-400 px-2 py-1 rounded" aria-label="Close category totals">✕</button>
                    </div>
                    {!(totals && totals.categoryTotals && totals.categoryTotals.length > 0) ? (
                      <div className="text-sm text-gray-500">No items to summarize.</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 dark:text-gray-300">
                              <th className="pb-2">Category</th>
                              <th className="pb-2 text-right">Subtotal</th>
                              <th className="pb-2 text-right">Tax</th>
                              <th className="pb-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(totals?.categoryTotals ?? []).map((c) => (
                              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                                <td className="py-2 text-gray-800 dark:text-gray-200">{c.name}</td>
                                <td className="py-2 text-right text-gray-700 dark:text-gray-300">${c.subtotal.toFixed(2)}</td>
                                <td className="py-2 text-right text-gray-700 dark:text-gray-300">${c.tax.toFixed(2)}</td>
                                <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">${c.total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
