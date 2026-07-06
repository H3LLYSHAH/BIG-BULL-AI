/**
 * reportHash
 * ----------
 * Produces a stable SHA-256 hash of a tax summary + its transactions, so the
 * exact same report always hashes to the exact same value (needed for
 * anyone to later verify "this report matches what was anchored on-chain").
 *
 * Uses the browser's native Web Crypto API — no extra dependency needed.
 */
export async function hashReport({ transactions, summary, uid }) {
  const canonical = canonicalize({
    uid,
    transactions: transactions.map((t) => ({
      date: t.date instanceof Date ? t.date.toISOString() : t.date,
      asset: t.asset,
      side: t.side ?? t.type,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee ?? 0,
    })),
    summary,
  });

  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}`;
}

/** Deterministic JSON stringify — sorts object keys so the same data always
 * produces the same string, regardless of property insertion order. */
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
