'use strict'

var express = require('express');
var router = express.Router();
var multer = require('multer');
let actualApi = require('@actual-app/api');
let envFilePath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: envFilePath });



// Use memory storage for simplicity (no files written to disk in this boilerplate)
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });



/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ message: 'Receipt Reader API' });
});

// GET /getBudgetInformation
// Returns budget categories and accounts from Actual API or example data if TEST_DATA_ENABLED is set.
router.get('/getBudgetInformation', async function(req, res) {
  // If Actual server is not configured, return an error
  if (!process.env.ACTUAL_SERVER_URL) {
    console.log('ACTUAL_SERVER_URL not configured; returning example categories.');
    return res.status(500).json({ error: 'ACTUAL_SERVER_URL not configured' });
  }

  // If TEST_DATA_ENABLED is set (string 'true'), return the printed/example categories
  if (process.env.TEST_DATA_ENABLED === 'true') {
    const sampleCategories = [
      { id: 'exampleCategory1', name: 'Example Category 1' },
      { id: 'exampleCategory2', name: 'Example Category 2' }
    ];

    const sampleAccounts = [
      { id: 'exampleAccount1', name: 'Example Account 1' },
      { id: 'exampleAccount2', name: 'Example Account 2' }
    ];

    return res.json({ availableCategories: sampleCategories, accounts: sampleAccounts });
  }

  // Otherwise, initialize Actual API, fetch categories and accounts, map them to {id,name}, and return.
  try {
    await actualApi.init({
      serverURL: process.env.ACTUAL_SERVER_URL,
      password: process.env.ACTUAL_PASSWORD,
      dataDir: './actualcache'
    });

    await actualApi.downloadBudget(process.env.ACTUAL_BUDGET_FILE_ID); // Load the budget file
    await actualApi.sync(); // Ensure data is up to date

    const categories = await actualApi.getCategories();
    const accounts = await actualApi.getAccounts ? await actualApi.getAccounts() : [];


    // Shut down the API client once finished
    try {
      await actualApi.shutdown();
    } catch (shutdownErr) {
      // Log but don't fail the whole request because of shutdown problems
      console.error('Error shutting down Actual API client:', shutdownErr);
    }

    // Map categories/accounts to the shape expected by the frontend
    const mappedCategories = Array.isArray(categories) ? categories.map(function(c) {
      return { id: c.id, name: c.name };
    }) : [];

    const mappedAccounts = Array.isArray(accounts) ? accounts.map(function(a) {
      return { id: a.id, name: a.name };
    }) : [];

    return res.json({ availableCategories: mappedCategories, accounts: mappedAccounts });
  } catch (err) {
    // Ensure we attempt to shutdown if init succeeded partially
    try {
      await actualApi.shutdown();
    } catch (e) {
      // ignore
    }

    console.error('Failed to get budget information from Actual API:', err);
    res.status(500).json({ error: 'Failed to fetch budget information', details: String(err) });
  }
});

// POST /analyzeReceipt
// Accepts multipart/form-data with a `file` field. Returns a sample analysis result.
router.post('/analyzeReceipt', upload.single('file'), function(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file field (multipart/form-data with name "file")' });
  }

  // In a real implementation, you'd pass req.file.buffer to an OCR/model here.
  // Return a canned response matching the OpenAPI example.
  res.json({
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
