# receipt-budgeter design

## Overview

The receipt budgeter is designed to extract and process information from various types of receipts, such as grocery, restaurant, and retail receipts. The system leverages multi-modal large language models (LLMs) to extract data from receipts, and to identify and categorize key data points.

## User Flow

1. **Input Receipt**: The user uploads a receipt image or PDF to the system.
2. **Data Extraction and Interpretation**: The system uses multi-modal LLMs to extract text and relevant information from the receipt. It identifies key data points such as item names, prices, total amount, date, and vendor information. Because the names of items on receipts are not always clear, they system also guesses what each item is based on the text and context (e.g., "KS Cage Free" is likely eggs, "NB Mag Glyc" is magnesium glycinate). Then, it categorizes these items into predefined categories received from Actual Budget (e.g., groceries, eating out, health, household items).
3. **User Review and Confirmation**: The extracted data and categorization is presented to the user for review. The user can confirm the accuracy of the data or make corrections if necessary.
4. **Add transaction to Actual Budget**: Once the user confirms the data, the system formats it appropriately and sends it to Actual Budget via their API to add the transaction to the user's account.

### Potential Future Enhancements

- **Multi-Receipt Processing**: Allow users to upload multiple receipts at once for batch processing.
- **Learning from Corrections**: Implement a feedback loop where the system learns from user corrections to improve future data extraction and categorization accuracy.

## Technical Details

### Client



