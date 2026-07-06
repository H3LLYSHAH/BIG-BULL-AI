const MS_PER_DAY = 1000 * 60 * 60 * 24;
const LONG_TERM_DAYS = 365;

export const TAX_METHODS = ['FIFO', 'LIFO', 'HIFO', 'WAC'];

export const TAX_METHOD_LABELS = {
  FIFO: 'FIFO — First In, First Out',
  LIFO: 'LIFO — Last In, First Out',
  HIFO: 'HIFO — Highest Cost First',
  WAC: 'WAC — Weighted Average Cost',
};

/**
 * computeLedger(transactions, method)
 * ------------------------------------
 * Same shape/behavior as the original FIFO-only version in App.jsx, but
 * `method` picks which lot gets consumed first on a sell:
 *   FIFO - oldest lot first (classic, most common default)
 *   LIFO - newest lot first
 *   HIFO - highest cost-basis lot first (usually minimizes taxable gain —
 *          common "tax optimization" choice, but check local rules apply)
 *   WAC  - no discrete lots; every buy blends into one running average cost
 *          per asset (simpler, but loses long/short-term nuance since there's
 *          no single "purchase date" per unit — we use the earliest
 *          contributing buy date still represented in the average as a
 *          reasonable proxy for term classification)
 *
 * transactions: [{ date: Date, asset, side: 'buy'|'sell', quantity, price, fee }]
 */
export function computeLedger(transactions, method = 'FIFO') {
  if (!TAX_METHODS.includes(method)) {
    throw new Error(`Unknown tax method "${method}". Expected one of: ${TAX_METHODS.join(', ')}`);
  }

  const lotsByAsset = new Map(); // FIFO/LIFO/HIFO: array of lots. WAC: single running lot.
  const rows = [];
  let shortTermGain = 0;
  let longTermGain = 0;
  let totalFees = 0;
  let totalProceeds = 0;

  for (const txn of transactions) {
    totalFees += txn.fee || 0;

    if (txn.side === 'buy') {
      const unitFee = txn.quantity > 0 ? (txn.fee || 0) / txn.quantity : 0;
      const costBasis = txn.price + unitFee;

      if (method === 'WAC') {
        const existing = lotsByAsset.get(txn.asset);
        if (!existing) {
          lotsByAsset.set(txn.asset, { quantity: txn.quantity, totalCost: costBasis * txn.quantity, earliestDate: txn.date });
        } else {
          existing.quantity += txn.quantity;
          existing.totalCost += costBasis * txn.quantity;
          // earliestDate intentionally unchanged — it anchors term classification
        }
      } else {
        const lots = lotsByAsset.get(txn.asset) || [];
        lots.push({ date: txn.date, quantity: txn.quantity, costBasis });
        lotsByAsset.set(txn.asset, lots);
      }

      rows.push({ ...txn, gain: null, term: null });
      continue;
    }

    // sell
    let gainForRow = 0;
    let longestTerm = 'short';
    let matchedAny = false;
    let remaining = txn.quantity;
    const sellUnitFee = txn.quantity > 0 ? (txn.fee || 0) / txn.quantity : 0;

    if (method === 'WAC') {
      const pos = lotsByAsset.get(txn.asset);
      if (pos && pos.quantity > 1e-9) {
        const avgCost = pos.totalCost / pos.quantity;
        const matchQty = Math.min(remaining, pos.quantity);
        const proceeds = (txn.price - sellUnitFee) * matchQty;
        const cost = avgCost * matchQty;
        gainForRow += proceeds - cost;
        totalProceeds += proceeds;
        matchedAny = true;

        const heldDays = (txn.date - pos.earliestDate) / MS_PER_DAY;
        longestTerm = heldDays >= LONG_TERM_DAYS ? 'long' : 'short';

        pos.totalCost -= cost;
        pos.quantity -= matchQty;
        remaining -= matchQty;
      }
    } else {
      const lots = lotsByAsset.get(txn.asset) || [];
      const orderedLots = method === 'HIFO'
        ? [...lots].sort((a, b) => b.costBasis - a.costBasis)
        : method === 'LIFO'
          ? [...lots].sort((a, b) => b.date - a.date)
          : lots; // FIFO: already in insertion (chronological) order

      while (remaining > 1e-9 && orderedLots.length) {
        const lot = orderedLots[0];
        const matchQty = Math.min(remaining, lot.quantity);
        const proceeds = (txn.price - sellUnitFee) * matchQty;
        const cost = lot.costBasis * matchQty;
        gainForRow += proceeds - cost;
        totalProceeds += proceeds;
        matchedAny = true;

        const heldDays = (txn.date - lot.date) / MS_PER_DAY;
        if (heldDays >= LONG_TERM_DAYS) longestTerm = 'long';

        lot.quantity -= matchQty;
        remaining -= matchQty;
        if (lot.quantity <= 1e-9) {
          orderedLots.shift();
          const idx = lots.indexOf(lot);
          if (idx !== -1) lots.splice(idx, 1);
        }
      }
    }

    if (matchedAny) {
      if (longestTerm === 'long') longTermGain += gainForRow;
      else shortTermGain += gainForRow;
    }

    rows.push({
      ...txn,
      gain: matchedAny ? gainForRow : null,
      term: matchedAny ? longestTerm : null,
      unmatchedQuantity: remaining > 1e-9 ? remaining : 0,
    });
  }

  return {
    method,
    rows,
    summary: {
      shortTermGain,
      longTermGain,
      totalGain: shortTermGain + longTermGain,
      totalFees,
      totalProceeds,
      transactionCount: transactions.length,
    },
  };
}
