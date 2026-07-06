import { useEffect, useRef, useState } from 'react';

/**
 * useLivePrices
 * -------------
 * Polls CoinGecko's free public API (no key required) for live prices.
 * Docs: https://www.coingecko.com/en/api/documentation
 *
 * Params:
 *   symbols    - e.g. ['BTC', 'ETH', 'SOL']
 *   intervalMs - poll frequency (default 15000ms — safely under CoinGecko's
 *                free-tier rate limit; don't go much below ~10s)
 *
 * Returns:
 *   {
 *     prices: { BTC: { usd: 68000, change24h: 2.31, direction: 'up' }, ... },
 *     loading,   // true only on the very first fetch
 *     error,     // string | null — set on fetch failure (network/rate-limit)
 *     lastUpdated, // Date | null
 *   }
 *
 * `direction` flips to 'up' or 'down' only when the price actually moves
 * between polls, so the UI can flash the digit briefly — separate from
 * `change24h`, which is CoinGecko's 24-hour percentage change.
 */
const SYMBOL_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  XRP: 'ripple',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  LTC: 'litecoin',
};

export function useLivePrices(symbols = ['BTC', 'ETH', 'SOL'], intervalMs = 15000) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevPricesRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    let timer;

    const ids = symbols
      .map((s) => SYMBOL_TO_ID[s.toUpperCase()])
      .filter(Boolean)
      .join(',');

    async function poll() {
      if (!ids) {
        setError('No recognized asset symbols to price.');
        setLoading(false);
        return;
      }
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`CoinGecko responded ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        const next = {};
        for (const symbol of symbols) {
          const id = SYMBOL_TO_ID[symbol.toUpperCase()];
          const entry = id && data[id];
          if (!entry) continue;

          const prevUsd = prevPricesRef.current[symbol]?.usd;
          let direction = 'flat';
          if (prevUsd != null) {
            if (entry.usd > prevUsd) direction = 'up';
            else if (entry.usd < prevUsd) direction = 'down';
          }

          next[symbol] = {
            usd: entry.usd,
            change24h: entry.usd_24h_change ?? null,
            direction,
          };
        }

        prevPricesRef.current = next;
        setPrices(next);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the price feed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    timer = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // Re-run if the symbol list changes; intervalMs intentionally not
    // included so changing it doesn't require a remount elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(',')]);

  return { prices, loading, error, lastUpdated };
}
