'use strict'

var express = require('express');
var router = express.Router();
var multer = require('multer');
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai')
const budgetService = require('../services/budgetService')

// Use memory storage for simplicity (no files written to disk in this boilerplate)
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });


// GET /status
// Health check endpoint
router.get('/status', function(req, res, next) {
  res.status(200).json({ status: 'ok' });
});

// GET /getBudgetInformation
// Returns budget categories and accounts from Actual API or example data if TEST_DATA_ENABLED is set.
router.get('/getBudgetInformation', async function(req, res) {
  try {
    const result = await budgetService.getBudgetInformation()
    return res.json(result)
  } catch (err) {
    console.error('Failed to get budget information from service:', err)
    // If the error indicates missing config, return 500 with a helpful message
    if (String(err).includes('ACTUAL_SERVER_URL')) {
      return res.status(500).json({ error: 'ACTUAL_SERVER_URL not configured' })
    }
    return res.status(500).json({ error: 'Failed to fetch budget information', details: String(err) })
  }
});

// POST /analyzeReceipt
// Accepts multipart/form-data with a `file` field. Returns a sample analysis result.
router.post('/analyzeReceipt', upload.single('file'), async function(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file field (multipart/form-data with name "file")' });
  }

  // Accept only specific image MIME types
  const acceptedMimes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif'
  ];
  const fileMime = req.file.mimetype;
  if (!acceptedMimes.includes(fileMime)) {
    return res.status(415).json({ error: 'Unsupported media type', allowedTypes: acceptedMimes });
  }

  // If TEST_DATA_ENABLED is set, return sample data instead of AI response
  if (process.env.TEST_DATA_ENABLED === 'true') {
    // Return object shaped to match OpenAPI AnalyzeReceiptResponse
    return res.json({
      receiptData: {
        subtotal: 42.5,
        total: 45.3,
        taxAmount: 2.8,
        storeName: 'Corner Grocery',
        storeLocation: '123 Woodward Ave, Detroit',
        taxRates: [
          {
            id: 'a',
            name: 'State Sales Tax',
            rate: 0.07,
            description: 'Statewide sales tax'
          }
        ]
      },
      items: [
        {
          itemId: 'item_1',
          itemName: '2% Reduced Fat',
          itemKind: 'milk',
          price: 3.5,
          budgetCategoryName: 'Grocery',
          budgetCategoryId: 'grocery',
          taxesApplied: []
        },
        {
          itemId: 'item_2',
          itemName: 'Whole Grain Loaf',
          itemKind: 'bread',
          price: 2.5,
          budgetCategoryName: 'Grocery',
          budgetCategoryId: 'grocery',
          taxesApplied: []
        },
        { itemId: 'item_3',
          itemName: 'Office Chair',
          itemKind: 'furniture',
          price: 40.0,
          budgetCategoryName: 'Home Improvement',
          budgetCategoryId: 'home_improvement',
          taxesApplied: ['a']
        }
      ]
    });
  }

  const aiClient = new GoogleGenAI({});

  // Generate receipt information from the uploaded file buffer
  let response;
  let base64ImageFile;
  try {
    base64ImageFile = req.file.buffer.toString('base64');

    const receiptDataPrompt = `Please list the items on this receipt, along with information about each item. 
    
    Your response should also include the name and location (meaning the city and state) of the store.
    Ignore any receipt annotations or markings that are not related to the items purchased (e.g. Costco's "Bottom of Basket" annotations). DO NOT ignore sub-items, such as discounts or bottle deposits.

    For each item, provide the name of the item as printed on the receipt.
    Each item should include a guess of what sort of product it is (e.g. milk, bread, furniture, etc.) and the price. 
    Your response should also include the subtotal, tax amount, and total as printed on the receipt. Include the tax rates if listed on the receipt. The rate should be in decimal format (e.g., 7% should be 0.07). Otherwise, return null for tax rates list.`

    // Get receipt contents
    const receiptInfoContents = [
      {
        inlineData: {
          mimeType: req.file.mimetype || "image/jpeg",
          data: base64ImageFile,
        },
      },
      { text: receiptDataPrompt },
    ];

    const receiptInfoConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING },
                  itemKind: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
                propertyOrdering: ["itemName", "itemKind", "price"]
              }
            },
            subtotal: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            storeName: { type: Type.STRING },
            storeLocation: { type: Type.STRING },
            taxAmount: { type: Type.NUMBER },
            taxRates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rate: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                propertyOrdering: ["rate", "description"]
              }
            }
          },
          propertyOrdering: ["items", "subtotal", "total", "storeName", "storeLocation", "taxAmount", "taxRates"]
        }
      };

    response = await aiClient.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: receiptInfoContents,
      config: receiptInfoConfig,
    });
    console.log(response.text);
  } catch (err) {
    console.error('Error generating receipt info:', err);
    return res.status(500).json({ error: 'AI receipt analysis failed', details: String(err) });
  }

  

  // Parse receipt response and normalize shapes. The AI may return items either
  // at the top-level as `items` or nested under `receiptData.items`. We want to
  // return a clean object { receiptData, items } where `receiptData` does NOT
  // include an `items` property.
  let receiptParsed;
  try {
    receiptParsed = JSON.parse(response.text);
  } catch (err) {
    console.error('Invalid JSON from receipt analysis AI:', err, 'text=', response && response.text);
    return res.status(500).json({ error: 'Invalid AI response for receipt analysis', details: String(err) });
  }

  // Pull out items from either top-level or nested receiptData
  let itemRequestList = [];
  if (Array.isArray(receiptParsed.items)) {
    itemRequestList = receiptParsed.items;
  } else if (receiptParsed.receiptData && Array.isArray(receiptParsed.receiptData.items)) {
    itemRequestList = receiptParsed.receiptData.items;
  }

  // Ensure stable itemId for matching
  for (let i = 0; i < itemRequestList.length; i++) {
    itemRequestList[i].itemId = itemRequestList[i].itemId || itemRequestList[i].id || `item_${i + 1}`;
  }

  let itemListText = "";
  for (const item of itemRequestList) {
    const name = item.itemName || item.name || '';
    const kind = item.itemKind || '';
    const id = item.itemId || item.id || '';
    itemListText += `- Name: ${name}, Item Kind: ${kind}, ID: ${id}\n`;
  }

  // Fetch budget categories once and build the list text
  const budgetInfo = await budgetService.getBudgetInformation();
  const budgetCategories = (budgetInfo && budgetInfo.availableCategories) || [];
  let budgetCategoriesText = "";
  for (const category of budgetCategories) {
    budgetCategoriesText += `- Name: ${category.name}, ID: ${category.id}\n`;
  }

  const itemCategoryContents = [
    { text: `Given the following list of items from a receipt, please provide a budget category guess for each item. The budget category should be selected from the provided list. If you're not sure of the category for an item, return category id 0 and category name 'Unknown'. Return your response as a JSON object where all data for each item is contained in a single array element.

      Available Budget Categories:
      ${budgetCategoriesText}


      Items:
      ${itemListText}` 
    }
  ];

  const itemCategoryConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            itemId: { type: Type.STRING },
            itemName: { type: Type.STRING },
            budgetCategoryName: { type: Type.STRING },
            budgetCategoryId: { type: Type.STRING }
          },
          propertyOrdering: ["itemId", "itemName", "budgetCategoryName", "budgetCategoryId"]
        }
      },
    };


  let categoryResponse;
  try {
    categoryResponse = await aiClient.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: itemCategoryContents,
      config: itemCategoryConfig,
    });
    console.log(categoryResponse.text);
  } catch (err) {
    console.error('Error generating item categories:', err);
    return res.status(500).json({ error: 'AI item categorization failed', details: String(err) });
  }

  // Check the response to make sure there is a category for each item, mapping by itemId.
  let itemCategories;
  try {
    itemCategories = JSON.parse(categoryResponse.text);
    if (!Array.isArray(itemCategories)) {
      throw new Error('Expected category response to be an array');
    }
  } catch (err) {
    console.error('Invalid JSON from category AI:', err, 'text=', categoryResponse && categoryResponse.text);
    // Fallback: start with an empty category list and mark all items Unknown below
    itemCategories = [];
  }
  const itemCategoryMap = {};
  for (const itemCategory of itemCategories) {
    itemCategoryMap[itemCategory.itemId] = itemCategory;
  }

  // Build final items list in the OpenAPI AnalyzedItem shape
  const finalItems = [];
  for (const item of itemRequestList) {
    const id = item.itemId || item.id || '';
    const cat = itemCategoryMap[id];
    if (!cat) {
      console.error('Missing category for item:', item);
    }
    finalItems.push({
      itemId: id,
      itemName: item.itemName || item.name || '',
      itemKind: item.itemKind || '',
      price: Number(item.price) || 0,
      budgetCategoryName: (cat && cat.budgetCategoryName) || (cat && cat.categoryName) || 'Unknown',
      budgetCategoryId: (cat && cat.budgetCategoryId) || (cat && cat.categoryId) || '0'
    });
  }

  // Ensure receiptData doesn't include a nested `items` array (we return
  // the items at top-level per the OpenAPI schema). The AI may return the
  // receipt fields either nested under `receiptData` or at the top-level
  // (subtotal, total, storeName, etc.). Normalize both cases.
  let returnedReceiptData = {};
  if (receiptParsed && receiptParsed.receiptData && typeof receiptParsed.receiptData === 'object') {
    returnedReceiptData = Object.assign({}, receiptParsed.receiptData);
  } else if (receiptParsed && typeof receiptParsed === 'object') {
    // Copy top-level properties except `items` (these are handled separately)
    for (const k of Object.keys(receiptParsed)) {
      if (k === 'items') continue;
      returnedReceiptData[k] = receiptParsed[k];
    }
  }
  if (returnedReceiptData.items) delete returnedReceiptData.items;

  // Ensure all tax rates have a stable ID
  if (Array.isArray(returnedReceiptData.taxRates)) {
    returnedReceiptData.taxRates.forEach((rate, i) => {
      rate.id = rate.id || `tax_rate_${i}`;
    });
  }

  const itemsWithTaxInfo = await determineTaxability(returnedReceiptData, finalItems);

  return res.json({
    receiptData: returnedReceiptData,
    items: itemsWithTaxInfo
  });
});

// POST /submitReceipt
// Accepts JSON body per OpenAPI `SubmitReceiptRequest` schema.
router.post('/submitReceipt', async function(req, res) {
  var body = req.body || {};

  // Debug: log key incoming fields to help trace why import may be skipped
  try {
    console.log('/submitReceipt received:', JSON.stringify({ accountId: body.accountId, createTransactions: body.createTransactions, doBankSync: body.doBankSync, receiptDate: body.receiptDate, total: body.total, subtotal: body.subtotal, splitsCount: Array.isArray(body.splits) ? body.splits.length : 0 }, null, 2))
  } catch (e) {
    console.log('/submitReceipt received: [unserializable body]')
  }

  // Always log splits and computed totals (helps debug when createTransactions is false)
  try {
    const splitsSummary = (body.splits || []).map(s => ({ categoryId: s.categoryId, amount: Number(s.amount) }))
    // compute expected total (prefer total, otherwise subtotal+tax, otherwise subtotal)
    let expectedTotal = null
    if (typeof body.total === 'number') expectedTotal = body.total
    else if (typeof body.subtotal === 'number' && typeof body.tax === 'number') expectedTotal = body.subtotal + body.tax
    else if (typeof body.subtotal === 'number') expectedTotal = body.subtotal
    console.log('/submitReceipt splits summary:', JSON.stringify(splitsSummary, null, 2))
    console.log('/submitReceipt computed expectedTotal:', expectedTotal)
  } catch (e) {
    console.log('/submitReceipt splits summary: [unserializable]')
  }

  if (!body.accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }
  if (!Array.isArray(body.splits) || body.splits.length === 0) {
    return res.status(400).json({ error: 'splits (non-empty array) is required' });
  }

  // Optional: validate splits sum matches the receipt total (prefer explicit `total`, otherwise `subtotal+tax`, otherwise `subtotal`).
  let expectedTotal = null
  if (typeof body.total === 'number') {
    expectedTotal = body.total
  } else if (typeof body.subtotal === 'number' && typeof body.tax === 'number') {
    expectedTotal = body.subtotal + body.tax
  } else if (typeof body.subtotal === 'number') {
    expectedTotal = body.subtotal
  }
  if (expectedTotal !== null) {
    const sum = body.splits.reduce(function(acc, s) { return acc + (Number(s.amount) || 0); }, 0);
    if (Math.abs(sum - expectedTotal) > 0.01) {
      return res.status(400).json({ error: 'splits must sum to receipt total', expectedTotal: expectedTotal, splitsTotal: sum });
    }
  }

  // In a real app you'd persist the transaction and generate an id.
  // Optionally run a bank sync and look for an existing matching transaction
  const doBankSync = body.doBankSync !== false; // default true per OpenAPI
  if (doBankSync) {
    try {
      await budgetService.runBankSync({ stringaccountId: body.accountId, ignoreErrors: true })
    } catch (err) {
      // Shouldn't throw when ignoreErrors is true, but log and continue if it does
      console.error('Bank sync failed (continuing):', err)
    }
  }

  // Determine date range for matching transactions
  const receiptDateStr = body.receiptDate || new Date().toISOString().slice(0,10)
  const receiptDate = new Date(receiptDateStr)
  const start = new Date(receiptDate)
  start.setDate(start.getDate() - 1)
  const end = new Date(receiptDate)
  end.setDate(end.getDate() + 1)
  const fmt = (d) => d.toISOString().slice(0,10)

  let existingTxs = []
  try {
    existingTxs = await budgetService.getTransactions(body.accountId, fmt(start), fmt(end))
  } catch (err) {
    console.error('Failed to fetch transactions for matching:', err)
    // Fall through; we don't want to block submission if lookup fails
    existingTxs = []
  }

  // Try to find a matching transaction by amount and (optionally) payee/imported_payee/imported_id
  const targetAmount = (typeof body.total === 'number') ? body.total : (typeof body.subtotal === 'number' ? body.subtotal : null)
  const merchant = (body.merchantName || '').toLowerCase()
  if (targetAmount !== null && Array.isArray(existingTxs) && existingTxs.length > 0) {
    for (const tx of existingTxs) {
      try {
        const rawAmount = tx.amount
        const txAmount = (rawAmount !== undefined && rawAmount !== null && !Number.isNaN(Number(rawAmount))) ? (Number(rawAmount) / 100) : NaN
        if (!Number.isNaN(txAmount) && Math.abs(txAmount - targetAmount) < 0.02) {
          // amount matches within tolerance; also try matching payee/merchant if available
          const payeeName = (tx.payee_name || tx.imported_payee || '').toLowerCase()
          const importedId = tx.imported_id || tx.importedId || ''
          if (!merchant || (payeeName && payeeName.includes(merchant)) || (body.importedId && importedId === body.importedId)) {
            if (body.createTransactions === true) {
              console.log('/submitReceipt matched existing transaction but createTransactions=true; proceeding to import. matched tx id:', tx.id)
              // continue to import below
            } else {
              console.log('/submitReceipt matched existing transaction, skipping import. matched tx id:', tx.id)
              return res.json({ ok: true, id: tx.id, existing: true, matchedTransaction: tx })
            }
          }
        }
      } catch (e) {
        // ignore per-transaction parse errors
      }
    }
  }

  // If requested, create the transaction in Actual using importTransactions
  if (body.createTransactions === true) {
    // Build a split transaction using the provided splits (already validated)
    const importId = body.importedId || ('rcpt_import_' + Date.now().toString(36))
    const txDate = body.receiptDate || new Date().toISOString().slice(0,10)
    const totalAmount = (typeof body.total === 'number') ? body.total : ((typeof body.subtotal === 'number' && typeof body.tax === 'number') ? (body.subtotal + body.tax) : (typeof body.subtotal === 'number' ? body.subtotal : null))

    // Actual API expects integer amounts (minor units). Convert dollars to cents.
    // Build notes to include merchant name and location plus any existing notes.
    const merchantName = body.merchantName || ''
    const merchantLocation = body.merchantLocation || ''
    const merchantInfo = [merchantName, merchantLocation].filter(Boolean).join(' — ')
    let combinedNotes = ''
    if (merchantInfo) combinedNotes = merchantInfo
    if (body.notes) combinedNotes = combinedNotes ? (combinedNotes + '\n' + body.notes) : body.notes

    const parentTx = {
      account: body.accountId,
      date: txDate,
      amount: (typeof totalAmount === 'number') ? Math.round(totalAmount * 100) : undefined,
      // Explicitly send `payee: null` to avoid providing an existing payee id;
      // keep `payee_name` so Actual can create or match a payee by name.
      payee: null,
      payee_name: body.merchantName || undefined,
      // Preserve the raw imported description
      imported_payee: body.merchantName || undefined,
      imported_id: importId,
      notes: combinedNotes || undefined,
      subtransactions: body.splits.map((s) => ({ amount: Math.round(Number(s.amount) * 100), category: s.categoryId, notes: s.description }))
    }

    try {
      console.log('/submitReceipt importing transactions for account:', body.accountId)
      try {
        // Log a human-readable summary of the splits (categoryId and amount in dollars)
        try {
          const splitsSummary = (body.splits || []).map(s => ({ categoryId: s.categoryId, amount: Number(s.amount) }))
          console.log('/submitReceipt splits summary:', JSON.stringify(splitsSummary, null, 2))
        } catch (e) {
          console.log('/submitReceipt splits summary: [unserializable]')
        }
        console.log('/submitReceipt import payload:', JSON.stringify([parentTx], null, 2))
      } catch (e) {
        console.log('/submitReceipt import payload: [unserializable]')
      }
      const addedIds = await budgetService.addTransactions(body.accountId, [parentTx], /*runTransfers=*/false, /*learnCategories=*/false)
      try { console.log('/submitReceipt addTransactions result (ids):', JSON.stringify(addedIds, null, 2)) } catch (e) { console.log('/submitReceipt addTransactions result: [unserializable]') }
      return res.json({ ok: true, id: importId, addedIds })
    } catch (err) {
      console.error('Import transactions failed:', err)
      return res.status(500).json({ error: 'Failed to create transaction', details: String(err) })
    }
  }

  // In a real app you'd persist the transaction and generate an id.
  var id = 'rcpt_' + Date.now().toString(36);
  res.json({ ok: true, id: id });
});


// health check endpoint
// Search for transactions that may match a receipt
// Query parameters: `transactionDate` (YYYY-MM-DD) and `accountId`
router.get('/searchTransactions', async function(req, res) {
  const transactionDate = req.query.transactionDate || req.query.date || null;
  const accountId = req.query.accountId || req.query.account || null;

  if (!transactionDate || !accountId) {
    return res.status(400).json({ error: 'transactionDate and accountId query parameters are required' });
  }

  // Build an inclusive date range: 1 day before and 4 days after the provided date
  try {
    const parsed = new Date(transactionDate);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({ error: 'transactionDate must be a valid date (YYYY-MM-DD)' });
    }
    const start = new Date(parsed);
    start.setDate(start.getDate() - 1);
    const end = new Date(parsed);
    end.setDate(end.getDate() + 4);
    const fmt = (d) => d.toISOString().slice(0,10);

    let txs = [];
    try {
      txs = await budgetService.getTransactions(accountId, fmt(start), fmt(end));
    } catch (err) {
      console.error('searchTransactions: failed to get transactions:', err);
      return res.status(500).json({ error: 'Failed to fetch transactions', details: String(err) });
    }

    const results = (Array.isArray(txs) ? txs : []).map((tx) => ({
      date: tx.date || null,
      transactionId: tx.id || null,
      accountId: tx.account || accountId,
      payeeName: tx.payee_name || tx.imported_payee || tx.payee || '',
      notes: tx.notes || '',
      amountPaid: (tx.amount !== undefined && tx.amount !== null && !Number.isNaN(Number(tx.amount))) ? Number((Number(tx.amount) / 100).toFixed(2)) : null
    }));

    return res.json(results);
  } catch (err) {
    console.error('searchTransactions handler error:', err);
    return res.status(500).json({ error: 'Internal server error', details: String(err) });
  }
});

router.get('/status', function(req, res) {
  res.json({ status: 'ok' });
});

/**
 * Determines which items are taxed based on receipt data.
 * @param {object} receiptData - The receipt data.
 * @param {Array<object>} items - The list of items.
 * @returns {Promise<Array<object>>} - The items with tax information.
 */
async function determineTaxability(receiptData, items) {
  const { taxAmount, taxRates, storeLocation } = receiptData;

  // Initialize taxesApplied array for each item
  items.forEach(item => {
    item.taxesApplied = [];
  });

  const hasSingleTaxRate = taxRates && Array.isArray(taxRates) && taxRates.length === 1 && typeof taxRates[0].rate === 'number' && taxRates[0].rate > 0;
  const hasTaxAmount = typeof taxAmount === 'number' && taxAmount > 0;

  if (hasSingleTaxRate && hasTaxAmount) {
    const taxRate = taxRates[0].rate;
    const taxRateId = taxRates[0].id; // ID is guaranteed by prior logic
    const taxableSubtotal = taxAmount / taxRate;

    // Helper to find a subset of items that sums to a target.
    // Uses a backtracking algorithm.
    const findSubset = (target, candidates) => {
      const result = [];
      const find = (currentTarget, index, currentSubset) => {
        // Using a small epsilon for floating point comparison
        if (Math.abs(currentTarget) < 0.01) {
          result.push(...currentSubset);
          return true;
        }
        if (currentTarget < 0 || index >= candidates.length) {
          return false;
        }

        // Try including the current item
        if (find(currentTarget - candidates[index].price, index + 1, [...currentSubset, candidates[index]])) {
          return true;
        }
        // Try excluding the current item
        if (find(currentTarget, index + 1, currentSubset)) {
          return true;
        }
        return false;
      };

      find(target, 0, []);
      return result;
    };

    let taxedItems = [];
    const centsAllowance = 5; // Search for a match allowing for up to 5 cents of rounding error
    for (let i = 0; i <= centsAllowance * 2; i++) {
      const offset = (i - centsAllowance) / 100.0; // Creates a range from -0.05 to +0.05
      const target = taxableSubtotal + offset;
      taxedItems = findSubset(target, items);
      if (taxedItems.length > 0) {
        // Found a combination that matches within the allowance
        break;
      }
    }

    if (taxedItems.length > 0) {
      const taxedItemIds = new Set(taxedItems.map(item => item.itemId));
      items.forEach(item => {
        if (taxedItemIds.has(item.itemId)) {
          item.taxesApplied.push(taxRateId);
        }
      });
      return items;
    }
  }

  // If no single tax rate or if the subset sum logic fails, ask the AI.
  const aiClient = new GoogleGenAI({});
  const taxAnalysisPrompt = `Which of these individual items on the receipt have the sales tax applied, according to the sales tax regulations where this store is located? please DO NOT consider receipt annotations/receipt divisions such as Costco's "Bottom of Basket/BOB". Ignore the annotations, and pay attention only to the items themselves.`;

  const groundingTool = {
    googleSearch: {},
    codeExecution: {}
  };

  
  const taxAnalysisSchema = {
    type: "object",
    properties: {
      tax_rates: {
        type: "array",
        description: "A list of all sales tax rates applicable in the area/on the receipt.",
        items: {
          type: "object",
          properties: {
            tax_id: {
              type: "string",
              description: "Unique identifier for this specific tax rate (e.g., 'state_tax', 'county_levy', 'GST'). This ID is used to reference the tax in the 'items' array."
            },
            description: {
              type: "string",
              description: "A human-readable description of the tax (e.g., 'California State Sales Tax', 'City of Exampleburg Utility Levy')."
            },
            rate: {
              type: "number",
              format: "float",
              description: "The tax rate as a decimal (e.g., 0.0825 for 8.25%)."
            }
          },
          required: [
            "tax_id",
            "description",
            "rate"
          ]
        }
      },
      items: {
        type: "array",
        description: "The list of individual products or services purchased.",
        items: {
          type: "object",
          properties: {
            item_id: {
              type: "string",
              description: "Unique identifier for this receipt item."
            },
            description: {
              type: "string",
              description: "Name or description of the item."
            },
            price: {
              type: "number",
              format: "float",
              description: "The price of a single unit."
            },
            applicable_tax_ids: {
              type: "array",
              description: "An array of 'tax_id' strings from the 'tax_rates' list that apply to this specific item.",
              items: {
                type: "string"
              },
              minItems: 0,
              uniqueItems: true
            }
          },
          required: [
            "item_id",
            "description",
            "price",
            "applicable_tax_ids"
          ]
        }
      },
      summary: {
        type: "object",
        description: "Summary of the financial totals for the receipt.",
        properties: {
          subtotal: {
            type: "number",
            format: "float",
            description: "The sum of all 'line_total_pre_tax' from the items list."
          },
          total_tax: {
            type: "number",
            format: "float",
            description: "The total amount of all taxes applied to all items."
          },
          grand_total: {
            type: "number",
            format: "float",
            description: "The final amount (subtotal + total_tax)."
          }
        },
        required: [
          "subtotal",
          "total_tax",
          "grand_total"
        ]
      }
    },
    required: [
      "tax_rates",
      "items",
      "summary"
    ]
  };

  try {
    const taxResponse = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: taxAnalysisPrompt }],
      config: taxAnalysisConfig,
    });
    const taxResult = JSON.parse(taxResponse.text);

    if (taxResult && Array.isArray(taxResult.taxableItems) && taxResult.taxableItems.length > 0) {
      const taxableItemNames = new Set(taxResult.taxableItems);
      let taxIdToApply;

      if (hasSingleTaxRate) {
        // If a single rate existed but the subset sum failed, use that existing rate's ID.
        taxIdToApply = receiptData.taxRates[0].id;
      } else {
        // Only create an "estimated" rate if no single rate was found to begin with.
        taxIdToApply = 'tax_rate_estimated';
        if (!receiptData.taxRates.some(rate => rate.id === taxIdToApply)) {
          receiptData.taxRates.push({
            id: taxIdToApply,
            description: 'Estimated tax based on item type',
            rate: null
          });
        }
      }

      items.forEach(item => {
        if (taxableItemNames.has(item.itemName)) {
          item.taxesApplied.push(taxIdToApply);
        }
      });
    }
  } catch (err) {
    console.error('AI tax analysis failed:', err);
    // Don't block the response if AI fails, just return items as-is.
  }

  return items;
}

module.exports = router;
