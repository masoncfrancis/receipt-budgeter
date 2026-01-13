const fs = require('fs')
const path = require('path')
let actualApi = require('@actual-app/api')
const envFilePath = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local'
require('dotenv').config({ path: envFilePath })

// Ensure './actualcache' exists in the process working directory (matches where
// the Actual API expects './actualcache' when running in Docker).
const actualCacheDir = path.join(process.cwd(), 'actualcache')
if (!fs.existsSync(actualCacheDir)) {
  try {
    fs.mkdirSync(actualCacheDir, { recursive: true })
    console.log('Created actualcache directory at', actualCacheDir)
  } catch (e) {
    console.error('Failed to create actualcache directory:', e)
  }
}

/**
 * Map Actual API category/account objects to { id, name }
 */
function mapToSimple(list) {
  if (!Array.isArray(list)) return []
  return list.map((x) => ({ id: x.id, name: x.name }))
}

/**
 * Initialize Actual API client with environment config
 */
async function initActual() {
  await actualApi.init({
    serverURL: process.env.ACTUAL_SERVER_URL,
    password: process.env.ACTUAL_PASSWORD,
    dataDir: actualCacheDir,
  })
}

async function shutdownActualQuiet() {
  try {
    await actualApi.shutdown()
  } catch (e) {
    // ignore shutdown errors but log for debugging
    console.error('Error shutting down Actual API client:', e)
  }
}

async function getCategoriesFromActual() {
  const categories = await actualApi.getCategories()
  return mapToSimple(categories)
}

async function getAccountsFromActual() {
  const accounts = actualApi.getAccounts ? await actualApi.getAccounts() : []
  return mapToSimple(accounts)
}

/**
 * Ensure the configured budget file is downloaded and the Actual API is synced.
 * No-op in TEST_DATA_ENABLED mode.
 */
async function ensureBudgetLoaded() {
  if (process.env.TEST_DATA_ENABLED === 'true') return
  if (process.env.ACTUAL_BUDGET_FILE_ID) {
    await actualApi.downloadBudget(process.env.ACTUAL_BUDGET_FILE_ID)
  }
  await actualApi.sync()
}

/**
 * Run the 3rd-party bank sync for the given account identifier.
 * Signature: runBankSync({ stringaccountId }) => Promise<void>
 */
async function runBankSync({ stringaccountId, ignoreErrors = false } = {}) {
  try {
    // Optionally attach global handlers early to catch async errors
    let uncaughtHandler, unhandledRejectionHandler
    let swallowed = false
    if (ignoreErrors) {
      uncaughtHandler = (err) => {
        swallowed = true
        console.error('runBankSync uncaughtException (ignored):', err)
      }
      unhandledRejectionHandler = (reason) => {
        swallowed = true
        console.error('runBankSync unhandledRejection (ignored):', reason)
      }
      process.on('uncaughtException', uncaughtHandler)
      process.on('unhandledRejection', unhandledRejectionHandler)
    }
    if (!stringaccountId) {
      if (ignoreErrors) {
        console.warn('runBankSync called without stringaccountId (ignored)')
        return
      }
      throw new Error('stringaccountId is required')
    }

    await initActual()
    try {
      await ensureBudgetLoaded()
    } catch (e) {
      if (ignoreErrors) {
        console.error('ensureBudgetLoaded failed (ignored):', e)
      } else {
        throw e
      }
    }
    if (!actualApi.runBankSync) {
      await shutdownActualQuiet()
      const err = new Error('actualApi.runBankSync not implemented')
      if (ignoreErrors) {
        console.error(err)
        return
      }
      throw err
    }

    try {
      await actualApi.runBankSync({ accountId: stringaccountId })
    } catch (e) {
      if (ignoreErrors) {
        console.error('runBankSync failed (ignored):', e)
        swallowed = true
      } else {
        throw e
      }
    }
  } catch (err) {
    if (ignoreErrors) {
      console.error('runBankSync caught and ignored error:', err)
      return
    }
    throw err
  } finally {
    // Remove any attached global handlers first
    try {
      if (ignoreErrors) {
        try { process.removeListener('uncaughtException', uncaughtHandler) } catch (er) {}
        try { process.removeListener('unhandledRejection', unhandledRejectionHandler) } catch (er) {}
      }
    } catch (er) {
      // ignore
    }

    try {
      await shutdownActualQuiet()
    } catch (e) {
      // already shutting down quietly
    }
  }
}

/**
 * Get transactions for an account between date strings (inclusive).
 * Signature: getTransactions(accountId, datestartDate, dateendDate) => Promise<Transaction[]>
 */
async function getTransactions(accountId, datestartDate, dateendDate) {
  if (!accountId) throw new Error('accountId is required')
  await initActual()
  try {
    await ensureBudgetLoaded()
  } catch (e) {
    // propagate as normal error to caller
    await shutdownActualQuiet()
    throw e
  }
  try {
    if (!actualApi.getTransactions) {
      throw new Error('actualApi.getTransactions not implemented')
    }
    const txs = await actualApi.getTransactions(accountId, datestartDate, dateendDate)
    return Array.isArray(txs) ? txs : []
  } finally {
    await shutdownActualQuiet()
  }
}

/**
 * Import transactions via Actual API importTransactions, which processes rules and avoids duplicates.
 * Signature: importTransactions(idaccountId, Transaction[]transactions) => Promise<{ errors, added, updated }>
 */
async function importTransactions(accountId, transactions) {
  if (!accountId) throw new Error('accountId is required')
  if (!Array.isArray(transactions)) throw new Error('transactions must be an array')
  await initActual()
  try {
    await ensureBudgetLoaded()
  } catch (e) {
    await shutdownActualQuiet()
    throw e
  }
  try {
    if (!actualApi.importTransactions) {
      throw new Error('actualApi.importTransactions not implemented')
    }
    // Log payload for debugging (helps trace import failures)
    try {
      console.log('importTransactions -> accountId:', accountId, 'transactions:', JSON.stringify(transactions, null, 2))
    } catch (e) {
      console.log('importTransactions -> accountId:', accountId, 'transactions: [unserializable]')
    }
    const result = await actualApi.importTransactions(accountId, transactions)
    return result
  } finally {
    await shutdownActualQuiet()
  }
}

  /**
   * Add transactions via Actual API addTransactions (raw add, no reconcile).
   * Signature: addTransactions(idaccountId, Transaction[]transactions, bool?runTransfers = false, bool?learnCategories = false) => Promise<id[]>
   */
  async function addTransactions(accountId, transactions, runTransfers = false, learnCategories = false) {
    if (!accountId) throw new Error('accountId is required')
    if (!Array.isArray(transactions)) throw new Error('transactions must be an array')
    await initActual()
    try {
      await ensureBudgetLoaded()
    } catch (e) {
      await shutdownActualQuiet()
      throw e
    }
    try {
      if (!actualApi.addTransactions) {
        throw new Error('actualApi.addTransactions not implemented')
      }
      // Log payload for debugging
      try {
        console.log('addTransactions -> accountId:', accountId, 'transactions:', JSON.stringify(transactions, null, 2), 'runTransfers:', runTransfers, 'learnCategories:', learnCategories)
      } catch (e) {
        console.log('addTransactions -> accountId:', accountId, 'transactions: [unserializable]')
      }
      const result = await actualApi.addTransactions(accountId, transactions, runTransfers, learnCategories)
      return result
    } finally {
      await shutdownActualQuiet()
    }
  }

/**
 * Main function used by routes: returns { availableCategories, accounts }
 * Honors TEST_DATA_ENABLED environment variable (string 'true').
 */
async function getBudgetInformation() {
  if (!process.env.ACTUAL_SERVER_URL) {
    throw new Error('ACTUAL_SERVER_URL not configured')
  }

  if (process.env.TEST_DATA_ENABLED === 'true') {
    const sampleCategories = [
      { id: 'exampleCategory1', name: 'Example Category 1' },
      { id: 'exampleCategory2', name: 'Example Category 2' },
    ]

    const sampleAccounts = [
      { id: 'exampleAccount1', name: 'Example Account 1' },
      { id: 'exampleAccount2', name: 'Example Account 2' },
    ]

    return { availableCategories: sampleCategories, accounts: sampleAccounts }
  }

  try {
    await initActual()
    await actualApi.downloadBudget(process.env.ACTUAL_BUDGET_FILE_ID)
    await actualApi.sync()

    const categories = await getCategoriesFromActual()
    const accounts = await getAccountsFromActual()

    await shutdownActualQuiet()

    return { availableCategories: categories, accounts: accounts }
  } catch (err) {
    // attempt shutdown if possible
    try {
      await shutdownActualQuiet()
    } catch (e) {
      // ignore
    }
    throw err
  }
}

/**
 * Update a transaction by id using the Actual API.
 * Signature: updateTransaction(id, fields) => Promise<null>
 */
async function updateTransaction(id, fields) {
  if (!id) throw new Error('id is required')
  if (!fields || typeof fields !== 'object') throw new Error('fields object is required')
  await initActual()
  try {
    await ensureBudgetLoaded()
  } catch (e) {
    await shutdownActualQuiet()
    throw e
  }
  try {
    if (!actualApi.updateTransaction) {
      throw new Error('actualApi.updateTransaction not implemented')
    }
    const result = await actualApi.updateTransaction(id, fields)
    return result
  } finally {
    await shutdownActualQuiet()
  }
}

/**
 * Delete a transaction by id using the Actual API.
 * Signature: deleteTransaction(id) => Promise<null>
 */
async function deleteTransaction(id) {
  if (!id) throw new Error('id is required')
  await initActual()
  try {
    await ensureBudgetLoaded()
  } catch (e) {
    await shutdownActualQuiet()
    throw e
  }
  try {
    if (!actualApi.deleteTransaction) {
      throw new Error('actualApi.deleteTransaction not implemented')
    }
    const result = await actualApi.deleteTransaction(id)
    return result
  } finally {
    await shutdownActualQuiet()
  }
}

module.exports = {
  getBudgetInformation,
  getCategoriesFromActual,
  getAccountsFromActual,
  runBankSync,
  getTransactions,
  importTransactions,
  addTransactions,
  updateTransaction,
  deleteTransaction,
}
