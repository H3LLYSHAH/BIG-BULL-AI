import { useState } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { hashReport } from '../lib/reportHash';

/**
 * ExportPackage
 * -------------
 * "Export & Filing Package" feature.
 *
 * Produces, on demand:
 *   - tax-report.pdf   — readable summary + transaction table
 *   - transactions.csv — raw ledger rows
 *   - proof.json        — report hash + (if available) on-chain anchor info
 *   - filing-package.zip — all three bundled together
 */
export default function ExportPackage({ transactions = [], summary, taxMethod }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function buildCsv() {
    const header = 'date,asset,side,quantity,price,fee,gain,term';
    const lines = transactions.map((t) =>
      [
        t.date instanceof Date ? t.date.toISOString() : t.date,
        t.asset,
        t.side,
        t.quantity,
        t.price,
        t.fee ?? 0,
        t.gain ?? '',
        t.term ?? '',
      ].join(',')
    );
    return [header, ...lines].join('\n');
  }

  function buildPdf() {
    const doc = new jsPDF();
    const money = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    doc.setFontSize(18);
    doc.text('BIG BULL AI — Tax Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Method: ${taxMethod}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

    doc.setFontSize(12);
    doc.text('Summary', 14, 46);
    doc.setFontSize(10);
    let y = 54;
    const rows = [
      ['Short-term gain', money(summary.shortTermGain)],
      ['Long-term gain', money(summary.longTermGain)],
      ['Total fees', money(summary.totalFees)],
      ['Net realized gain', money(summary.totalGain)],
      ['Transactions', String(summary.transactionCount)],
    ];
    rows.forEach(([label, value]) => {
      doc.text(label, 14, y);
      doc.text(value, 100, y);
      y += 7;
    });

    y += 6;
    doc.setFontSize(12);
    doc.text('Transactions', 14, y);
    y += 8;
    doc.setFontSize(8);
    doc.text('Date', 14, y);
    doc.text('Asset', 44, y);
    doc.text('Side', 64, y);
    doc.text('Qty', 84, y);
    doc.text('Price', 104, y);
    doc.text('Gain', 130, y);
    doc.text('Term', 155, y);
    y += 5;

    transactions.forEach((t) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const dateLabel = t.date instanceof Date ? t.date.toLocaleDateString() : String(t.date);
      doc.text(dateLabel, 14, y);
      doc.text(String(t.asset), 44, y);
      doc.text(String(t.side), 64, y);
      doc.text(String(t.quantity), 84, y);
      doc.text(Number(t.price).toFixed(2), 104, y);
      doc.text(t.gain != null ? Number(t.gain).toFixed(2) : '—', 130, y);
      doc.text(t.term ?? '—', 155, y);
      y += 5;
    });

    doc.setFontSize(8);
    doc.text(
      'This is a planning estimate, not a filing. Verify with a tax professional before filing.',
      14,
      290
    );

    return doc;
  }

  async function handleDownload(kind) {
    setError(null);
    setBusy(true);
    try {
      if (kind === 'pdf') {
        buildPdf().save('tax-report.pdf');
      } else if (kind === 'csv') {
        downloadBlob(buildCsv(), 'transactions.csv', 'text/csv');
      } else if (kind === 'proof') {
        const reportHash = await hashReport({ transactions, summary, uid: 'local' });
        downloadBlob(
          JSON.stringify({ reportHash, generatedAt: new Date().toISOString() }, null, 2),
          'proof.json',
          'application/json'
        );
      } else if (kind === 'zip') {
        const zip = new JSZip();
        const pdfBlob = buildPdf().output('blob');
        const reportHash = await hashReport({ transactions, summary, uid: 'local' });

        zip.file('tax-report.pdf', pdfBlob);
        zip.file('transactions.csv', buildCsv());
        zip.file(
          'proof.json',
          JSON.stringify({ reportHash, generatedAt: new Date().toISOString() }, null, 2)
        );
        zip.file(
          'README.txt',
          'BIG BULL AI filing package\n\n- tax-report.pdf : readable summary + transaction table\n- transactions.csv : raw transaction ledger\n- proof.json : SHA-256 hash of this report (see Proof on Blockchain in-app to anchor/verify it on Polygon Amoy)\n\nThis package is a planning estimate, not a filing — verify with a tax professional.\n'
        );

        const blob = await zip.generateAsync({ type: 'blob' });
        downloadFile(blob, 'filing-package.zip');
      }
    } catch (err) {
      setError(err.message || 'Could not generate that file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-package">
      <style>{`
        .export-package { background:#000; border-radius:12px; padding:20px; font-family: ui-monospace, 'IBM Plex Mono', monospace; }
        .export-package__title { font-size:13px; text-transform:uppercase; letter-spacing:1.5px; color:#c9932f; margin:0 0 12px; }
        .export-package__grid { display:flex; gap:10px; flex-wrap:wrap; }
        .export-package__btn { background:transparent; border:1px solid #232c3a; color:#c8cdd6; border-radius:6px; padding:10px 16px; font-size:11.5px; font-family:inherit; text-transform:uppercase; letter-spacing:1px; cursor:pointer; }
        .export-package__btn:hover { border-color:#c9932f; color:#c9932f; }
        .export-package__btn:disabled { opacity:0.5; cursor:not-allowed; }
        .export-package__btn--primary { background:#c9932f; color:#2a1c05; border:none; }
        .export-package__error { color:#d64545; font-size:11.5px; margin-top:10px; }
      `}</style>
      <p className="export-package__title">Export &amp; Filing Package</p>
      <div className="export-package__grid">
        <button className="export-package__btn" disabled={busy} onClick={() => handleDownload('pdf')}>
          Tax report (PDF)
        </button>
        <button className="export-package__btn" disabled={busy} onClick={() => handleDownload('csv')}>
          Transactions (CSV)
        </button>
        <button className="export-package__btn" disabled={busy} onClick={() => handleDownload('proof')}>
          Proof file (JSON)
        </button>
        <button
          className="export-package__btn export-package__btn--primary"
          disabled={busy}
          onClick={() => handleDownload('zip')}
        >
          {busy ? 'Building…' : 'Full filing package (.zip)'}
        </button>
      </div>
      {error && <p className="export-package__error">{error}</p>}
    </div>
  );
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  downloadFile(blob, filename);
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
