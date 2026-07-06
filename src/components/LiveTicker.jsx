import React from 'react';
import { useLivePrices } from '../hooks/useLivePrices';
import CandleLoader from './CandleLoader';

/**
 * LiveTicker
 * ----------
 * Shows real-time-ish crypto prices (polled from CoinGecko every ~15s).
 * - Green when a price ticks up, red when it ticks down, from CoinGecko's
 *   24h change (and a brief flash when the price actually moves between polls).
 * - Shows the CandleLoader buffering animation on first load and whenever
 *   the feed can't be reached (network issue / rate limit), so it's clear
 *   the app is retrying rather than stuck or broken.
 *
 * Usage: <LiveTicker symbols={['BTC', 'ETH', 'SOL']} />
 */
export default function LiveTicker({ symbols = ['BTC', 'ETH', 'SOL'] }) {
  const { prices, loading, error, lastUpdated } = useLivePrices(symbols);

  if (loading) {
    return (
      <div className="live-ticker live-ticker--pending">
        <TickerStyles />
        <CandleLoader label="Fetching live prices…" tone="mixed" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-ticker live-ticker--pending">
        <TickerStyles />
        <CandleLoader label={`Connection issue — retrying… (${error})`} tone="down" />
      </div>
    );
  }

  return (
    <div className="live-ticker">
      <TickerStyles />
      <div className="live-ticker__row">
        {symbols.map((symbol) => {
          const p = prices[symbol];
          if (!p) return null;
          const up = (p.change24h ?? 0) >= 0;
          return (
            <div
              key={symbol}
              className={`live-ticker__item live-ticker__item--flash-${p.direction}`}
            >
              <span className="live-ticker__symbol">{symbol}</span>
              <span className={`live-ticker__price ${up ? 'is-up' : 'is-down'}`}>
                ${p.usd.toLocaleString(undefined, { maximumFractionDigits: p.usd < 1 ? 6 : 2 })}
              </span>
              <span className={`live-ticker__change ${up ? 'is-up' : 'is-down'}`}>
                {up ? '▲' : '▼'} {Math.abs(p.change24h ?? 0).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
      {lastUpdated && (
        <div className="live-ticker__updated">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function TickerStyles() {
  return (
    <style>{`
      .live-ticker {
        --up: #2fae66;
        --down: #d64545;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-family: ui-monospace, 'IBM Plex Mono', monospace;
      }
      .live-ticker--pending {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px 0;
      }
      .live-ticker__row {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
      }
      .live-ticker__item {
        display: flex;
        align-items: baseline;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 6px;
        background: rgba(255,255,255,0.03);
        transition: background-color 0.4s ease;
      }
      .live-ticker__item--flash-up { animation: flash-up 0.6s ease; }
      .live-ticker__item--flash-down { animation: flash-down 0.6s ease; }
      @keyframes flash-up { 0% { background-color: rgba(47,174,102,0.35); } 100% { background-color: rgba(255,255,255,0.03); } }
      @keyframes flash-down { 0% { background-color: rgba(214,69,69,0.35); } 100% { background-color: rgba(255,255,255,0.03); } }
      .live-ticker__symbol { font-size: 12px; color: #9aa3b2; letter-spacing: 0.5px; }
      .live-ticker__price { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
      .live-ticker__change { font-size: 11.5px; font-variant-numeric: tabular-nums; }
      .is-up { color: var(--up); }
      .is-down { color: var(--down); }
      .live-ticker__updated { font-size: 10.5px; color: #6b7280; }
      @media (prefers-reduced-motion: reduce) {
        .live-ticker__item--flash-up, .live-ticker__item--flash-down { animation: none; }
      }
    `}</style>
  );
}
