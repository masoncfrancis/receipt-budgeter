var express = require('express');
var router = express.Router();
var multer = require('multer');

// Use memory storage for simplicity (no files written to disk in this boilerplate)
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });



/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ message: 'Receipt Reader API' });
});

// GET /getBudgetInformation
// Returns example budget categories and accounts from openapi.yaml
router.get('/getBudgetInformation', function(req, res) {
  res.json({
    availableCategories: [
      { id: 'food', name: 'Food & Dining' },
      { id: 'transport', name: 'Transportation' }
    ],
    accounts: [
      { id: 'checking', name: 'Checking Account' },
      { id: 'credit-card', name: 'Credit Card' }
    ]
  });
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
