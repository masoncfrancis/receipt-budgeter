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
  // Total tax amount reported on the receipt (optional)
  taxAmount?: number
  // List of tax rate objects discovered on the receipt (id+rate+optional name/description)
  taxRates?: Array<{
    id: string
    name?: string
    description?: string
    rate?: number | null
  }>
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
  // Optional list of tax rate ids that apply to this item
  taxesApplied?: string[]
  // Whether this item was manually added by the user (true) or came from analysis/OCR (false or undefined)
  manual?: boolean
}

export type MockResponse = ParsedItem[]
