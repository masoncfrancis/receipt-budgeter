export type ParsedItem = {
  id: string
  name: string
  kind?: string
  budgetCategory?: string
  // Price in the item's currency (USD assumed). Optional until OCR provides it.
  price?: number
  // Whether this item was manually added by the user (true) or came from analysis/OCR (false or undefined)
  manual?: boolean
  // New: which payment method/account funded this transaction
  paymentMethod?: string
}

export type MockResponse = ParsedItem[]
