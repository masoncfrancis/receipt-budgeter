export type Category = {
  id: string
  name: string
}

export type Account = {
  id: string
  name: string
}

export type BudgetInformationResponse = {
  availableCategories: Category[]
  accounts: Account[]
}

export type ReceiptData = {
  subtotal?: number
  total: number
  storeName?: string
  storeLocation?: string
}

export type AnalyzedItem = {
  itemId: string
  itemName: string
  itemKind?: string
  price: number
  budgetCategoryName?: string
  budgetCategoryId?: string
}

export type AnalyzeReceiptResponse = {
  receiptData: ReceiptData
  items: AnalyzedItem[]
}

export type ParsedItem = {
  id: string
  name: string
  kind?: string
  budgetCategory?: string // This will be budgetCategoryId
  budgetCategoryName?: string
  // Price in the item's currency (USD assumed). Optional until OCR provides it.
  price?: number
  // Whether this item was manually added by the user (true) or came from analysis/OCR (false or undefined)
  manual?: boolean
}

export type MockResponse = ParsedItem[]
