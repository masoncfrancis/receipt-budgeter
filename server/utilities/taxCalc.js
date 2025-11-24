/**
 * Estimates which items are taxable given a list of items, total tax, and tax rate.
 * This uses a dynamic programming approach to solve the subset sum problem.
 *
 * @param {Array<Object>} items - An array of items, each with an id and a price.
 * @param {number} totalTax - The total tax amount from the receipt.
 * @param {number} taxRate - The tax rate applied to taxable items.
 * @returns {Object|null} An object containing arrays of taxable and tax-exempt items, or null if no solution is found.
 */
function findTaxableItems(items, totalTax, taxRate) {
  if (taxRate <= 0 || totalTax < 0) {
    // If no tax, all items are tax-exempt. If tax is negative, data is invalid.
    return { taxable: [], taxExempt: items };
  }

  // Use integers (cents) to avoid floating point inaccuracies.
  const taxableAmountInCents = Math.round((totalTax / taxRate) * 100);
  const itemsInCents = items.map((item) => ({
    ...item,
    priceInCents: Math.round((item.price || 0) * 100),
  }));

  // dp[i] will store the last item index used to form the sum 'i'.
  // A value of -1 indicates the sum 'i' is not possible.
  const dp = new Array(taxableAmountInCents + 1).fill(-1);
  dp[0] = 0; // Sum of 0 is possible with no items.

  for (let i = 0; i < itemsInCents.length; i++) {
    const item = itemsInCents[i];
    // Iterate backwards to prevent using the same item multiple times in one subset.
    for (let j = taxableAmountInCents; j >= item.priceInCents; j--) {
      // If sum 'j' is not yet possible, but sum 'j - item.price' is...
      if (dp[j] === -1 && dp[j - item.priceInCents] !== -1) {
        // ...then we can form sum 'j' by adding the current item.
        dp[j] = i; // Store the index of the item used.
      }
    }
  }

  // If the target taxable amount was not achievable
  if (dp[taxableAmountInCents] === -1) {
    console.warn(
      "Could not find a perfect subset of items that explains the tax. The receipt data might have small rounding errors or be incorrect."
    );
    return null; // No exact solution found
  }

  // Backtrack to find the items in the taxable subset.
  const taxableIds = new Set();
  let currentSum = taxableAmountInCents;

  while (currentSum > 0) {
    const itemIndex = dp[currentSum];
    if (itemIndex === -1) {
      // Should not happen if we found a solution, but as a safeguard.
      return null;
    }
    const item = itemsInCents[itemIndex];
    taxableIds.add(item.id);

    const nextSum = currentSum - item.priceInCents;

    // Find the previous state before this item was added
    let tempSum = nextSum;
    while (dp[tempSum] >= itemIndex && tempSum > 0) {
      tempSum--;
    }
    currentSum = tempSum;
  }

  const result = {
    taxable: [],
    taxExempt: [],
  };

  for (const item of items) {
    taxableIds.has(item.id) ? result.taxable.push(item) : result.taxExempt.push(item);
  }

  return result;
}

module.exports = { findTaxableItems };