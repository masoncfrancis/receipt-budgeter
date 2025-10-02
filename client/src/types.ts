export type ReceiptItem = {
  name: string
  kind: string
  budgetCategory: string
}

export const MOCK_CATEGORIES = [
  'groceries',
  'dining',
  'transport',
  'utilities',
  'entertainment',
  'other',
]

export const MOCK_ITEMS: ReceiptItem[] = [
  { name: 'Whole wheat bread', kind: 'bread', budgetCategory: 'groceries' },
  { name: 'Organic milk', kind: 'dairy', budgetCategory: 'groceries' },
  { name: 'Bananas', kind: 'produce', budgetCategory: 'groceries' },
]
