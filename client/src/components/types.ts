export type ParsedItem = {
  id: string
  name: string
  kind?: string
  budgetCategory?: string
  // New: which payment method/account funded this transaction
  paymentMethod?: string
}

export type MockResponse = ParsedItem[]
