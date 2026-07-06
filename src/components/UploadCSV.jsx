import { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';

// Accepts common header variations so real exports from different
// exchanges/wallets don't need to be hand-edited before upload.
const HEADER_ALIASES = {
  date: ['date', 'timestamp', 'time', 'datetime'],
  asset: ['asset', 'symbol', 'coin', 'ticker', 'currency'],
  side: ['side', 'type', 'action', 'direction'],
  quantity: ['quantity', 'qty', 'amount', 'units'],
  price: ['price', 'rate', 'unit price', 'price per unit'],
  fee: ['fee', 'fees', 'commission'],
};

function findKey(row, field) {
  const keys = Object.keys(row);
  const aliases = HEADER_ALIASES[field];
  const match = keys.find((k) => aliases.includes(k.trim().toLowerCase()));
  return match;
}

function normalizeRows(rawRows) {
  if (!rawRows.length) return { rows: [], error: 'The file has no rows.' };

  const sample = rawRows[0];
  const dateKey = findKey(sample, 'date');
  const assetKey = findKey(sample, 'asset');
  const sideKey = findKey(sample, 'side');
  const qtyKey = findKey(sample, 'quantity');
  const priceKey = findKey(sample, 'price');
  const feeKey = findKey(sample, 'fee');

  const missing = [];
  if (!dateKey) missing.push('date');
  if (!assetKey) missing.push('asset');
  if (!sideKey) missing.push('side (buy/sell)');
  if (!qtyKey) missing.push('quantity');
  if (!priceKey) missing.push('price');

  if (missing.length) {
    return {
      rows: [],
      error: `Couldn't find a column for: ${missing.join(', ')}. Check the file's headers.`,
    };
  }

  const rows = rawRows
    .filter((r) => r[dateKey] && r[assetKey])
    .map((r, i) => {
      const rawSide = String(r[sideKey] || '').trim().toLowerCase();
      const side = rawSide.startsWith('s') ? 'sell' : rawSide.startsWith('b') ? 'buy' : rawSide;
      return {
        id: `${i}-${r[dateKey]}-${r[assetKey]}`,
        date: new Date(r[dateKey]),
        asset: String(r[assetKey]).trim().toUpperCase(),
        side,
        quantity: parseFloat(r[qtyKey]) || 0,
        price: parseFloat(r[priceKey]) || 0,
        fee: feeKey ? parseFloat(r[feeKey]) || 0 : 0,
      };
    })
    .filter((r) => (r.side === 'buy' || r.side === 'sell') && r.quantity > 0)
    .sort((a, b) => a.date - b.date);

  if (!rows.length) {
    return { rows: [], error: 'No valid buy/sell rows were found in the file.' };
  }

  return { rows, error: null };
}

const SAMPLE_CSV = `date,asset,side,quantity,price,fee
2025-01-15,BTC,buy,0.5,42000,12
2025-03-02,ETH,buy,4,2400,8
2025-06-20,BTC,sell,0.5,68000,15
2025-08-11,ETH,buy,2,3100,6
2025-11-04,ETH,sell,3,3400,10
`;

// `onFile` is optional and new: it hands back the raw File object (before
// parsing) so a caller can archive the original CSV — e.g. upload it to
// Firebase Storage — without needing to reconstruct it from parsed rows.
export default function UploadCSV({ onParsed, onFile }) {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      setError(null);
      onFile?.(file);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const { rows, error: parseError } = normalizeRows(results.data);
          if (parseError) {
            setError(parseError);
            return;
          }
          onParsed(rows);
        },
        error: () => setError('Could not read that file. Try exporting it again as CSV.'),
      });
    },
    [onParsed, onFile]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragActive(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  const downloadSample = (e) => {
    e.stopPropagation();
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="upload-panel">
      <label
        className={`upload-panel__dropzone${isDragActive ? ' upload-panel__dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
      >
        <svg className="upload-panel__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 16V4m0 0L7 9m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="upload-panel__cta">Drop a transaction CSV, or click to browse</p>
        <p className="upload-panel__hint">date · asset · side · quantity · price · fee</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      {error && <p className="upload-panel__error">{error}</p>}

      <a href="#" className="upload-panel__sample" onClick={downloadSample}>
        Download a sample CSV
      </a>
    </div>
  );
}
