import type { SearchedTransaction } from './types'

type Props = {
  open: boolean
  onClose: () => void
  loading: boolean
  transactions: SearchedTransaction[]
  onSelect: (tx: SearchedTransaction) => void
}

export default function TransactionSearchModal({ open, onClose, loading, transactions, onSelect }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select a matching transaction</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>
        {loading ? (
          <div className="py-8 text-center">Searching...</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto">
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-gray-600">No matching transactions found.</div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.transactionId} className="p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900 dark:text-white">{tx.payeeName || 'Unknown'}</div>
                      <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">{tx.isPayment ? 'Payment' : 'Refund'}</div>
                    </div>
                    <div className="text-sm text-gray-500">{tx.date} — ${tx.amountPaid?.toFixed(2) ?? '0.00'}</div>
                    {tx.notes && <div className="text-xs text-gray-400 truncate max-w-md">{tx.notes}</div>}
                  </div>
                  <div>
                    <button onClick={() => onSelect(tx)} className="px-3 py-1 bg-blue-600 text-white rounded">Select</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">Close</button>
        </div>
      </div>
    </div>
  )
}
