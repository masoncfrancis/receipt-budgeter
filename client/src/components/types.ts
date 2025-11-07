export type ParsedItem = {
  id: string
  name: string
  kind?: string
  budgetCategory?: string
  // Price in the item's currency (USD assumed). Optional until OCR provides it.
  price?: number
  // New: which payment method/account funded this transaction
  paymentMethod?: string
}

export type MockResponse = ParsedItem[]
