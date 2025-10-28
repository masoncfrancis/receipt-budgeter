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

module.exports = {
  getBudgetInformation,
  getCategoriesFromActual,
  getAccountsFromActual,
}
