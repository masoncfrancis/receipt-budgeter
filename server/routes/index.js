'use strict'

var express = require('express');
var router = express.Router();
var multer = require('multer');
const { GoogleGenAI, Type } = require('@google/genai')
const budgetService = require('../services/budgetService')

// Use memory storage for simplicity (no files written to disk in this boilerplate)
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });


/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ message: 'Receipt Budgeter API' });
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
    return res.json({
      merchantName: 'Corner Grocery',
      merchantLocation: '123 Woodward Ave, Detroit',
      receiptDate: '2025-10-01',
      subtotal: 42.5,
      taxAmount: 3.4,
      totalPrice: 45.9,
      items: [
        {
          name: '2% Reduced Fat',
          itemKind: 'milk',
          budgetCategoryGuess: 'grocery',
          price: 3.5
        },
        {
          name: 'Whole Grain Loaf',
          itemKind: 'bread',
          budgetCategoryGuess: 'grocery',
          price: 2.5
        }
      ]
    });
  }

  const aiClient = new GoogleGenAI({});

  // Generate receipt information from the uploaded file buffer
  let response;
  try {
    const base64ImageFile = req.file.buffer.toString('base64');

    // Get receipt contents
    const receiptInfoContents = [
      {
        inlineData: {
          mimeType: req.file.mimetype || "image/jpeg",
          data: base64ImageFile,
        },
      },
      { text: "Please list the items on this receipt, along with information about each item. Each item should include a guess of what sort of product it is (e.g. milk, bread, furniture, etc.) and the price. Your response should also include the name and location of the store. It should also include the subtotal and total for the receipt." },
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
                  price: { type: Type.NUMBER }
                },
                propertyOrdering: ["itemName", "itemKind", "price"]
              }
            },
            subtotal: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            storeName: { type: Type.STRING },
            storeLocation: { type: Type.STRING }
          },
          propertyOrdering: ["items", "subtotal", "total", "storeName", "storeLocation"]
        },
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




  // Parse receipt response and create an item id for each item to help with matching later
  let receiptParsed;
  try {
    receiptParsed = JSON.parse(response.text);
  } catch (err) {
    console.error('Invalid JSON from receipt analysis AI:', err, 'text=', response && response.text);
    return res.status(500).json({ error: 'Invalid AI response for receipt analysis', details: String(err) });
  }

  const itemRequestList = receiptParsed.items || [];
  for (let i = 0; i < itemRequestList.length; i++) {
    itemRequestList[i].id = `item_${i + 1}`;
  }

  let itemListText = "";
  for (const item of itemRequestList) {
    const name = item.itemName || item.name || '';
    const kind = item.itemKind || '';
    itemListText += `- Name: ${name}, Item Kind: ${kind}, ID: ${item.id}\n`;
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

  // Check the response to make sure there is a category for each item, checking to make sure all item ids are present. If one is missing, set it's category id to 0 and category name to "Unknown". Log an error but don't fail the request.
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
  for (const item of itemRequestList) {
    if (!itemCategoryMap[item.id]) {
      console.error('Missing category for item:', item);
      itemCategories.push({
        itemId: item.id,
        itemName: item.itemName,
        budgetCategoryId: '0',
        budgetCategoryName: 'Unknown'
      });
    }
  }

  return res.json({
    receiptData: JSON.parse(response.text),
    itemCategories: itemCategories
  });
});

// POST /submitReceipt
// Accepts JSON body per OpenAPI `SubmitReceiptRequest` schema.
router.post('/submitReceipt', function(req, res) {
  var body = req.body || {};

  if (!body.accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }
  if (!Array.isArray(body.splits) || body.splits.length === 0) {
    return res.status(400).json({ error: 'splits (non-empty array) is required' });
  }

  // Optional: validate splits sum matches subtotal (if subtotal provided)
  if (typeof body.subtotal === 'number') {
    var sum = body.splits.reduce(function(acc, s) { return acc + (Number(s.amount) || 0); }, 0);
    // Allow small floating point tolerance
    if (Math.abs(sum - body.subtotal) > 0.01) {
      return res.status(400).json({ error: 'splits must sum to subtotal', subtotal: body.subtotal, splitsTotal: sum });
    }
  }

  // In a real app you'd persist the transaction and generate an id.
  var id = 'rcpt_' + Date.now().toString(36);
  res.json({ ok: true, id: id });
});


// health check endpoint
router.get('/status', function(req, res) {
  res.json({ status: 'ok' });
});

module.exports = router;
