import { useEffect, useMemo, useState } from 'react';
import MoneyRainBackground from './components/MoneyRainBackground';
import UploadCSV from './components/UploadCSV';
import TransactionCards3D from './components/TransactionCards3D';
import TaxSummary from './components/TaxSummary';
import Login from './components/Login';
import LiveTicker from './components/LiveTicker';
import ClassifiedTransactions3D from './components/ClassifiedTransactions3D';
import ProofOfExistenceSeal from './components/ProofOfExistenceSeal';
import CandleLoader3D from './components/CandleLoader3D';
import TaxMethodSelector from './components/TaxMethodSelector';
import Charts3D from './components/Charts3D';
import ExportPackage from './components/ExportPackage';
import { useAuth } from './hooks/useAuth';
import { saveSession } from './lib/saveSession';
import { computeLedger } from './lib/costBasisMethods';
import './theme.css';

export default function App() {
  const user = useAuth();

  const [transactions, setTransactions] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [taxMethod, setTaxMethod] = useState('FIFO');

  const ledger = useMemo(
    () => (transactions ? computeLedger(transactions, taxMethod) : null),
    [transactions, taxMethod]
  );

  function handleParsed(rows) {
    setTransactions(rows);
    setSessionId(crypto.randomUUID());
    setSaveStatus('idle');
  }

  function handleReset() {
    setTransactions(null);
    setSessionId(null);
    setSaveStatus('idle');
    setSaveError(null);
  }

  useEffect(() => {
    if (!user || !ledger || !sessionId) return;
    let cancelled = false;

    (async () => {
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await saveSession(user.uid, sessionId, {
          csvFile: null,
          rows: ledger.rows,
          summary: ledger.summary,
        });
        if (!cancelled) setSaveStatus('saved');
      } catch (err) {
        if (!cancelled) {
          setSaveStatus('error');
          setSaveError(err.message || 'Could not save to your account.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, ledger, sessionId]);

  if (user === undefined) {
    return (
      <div className="app-shell app-shell--centered">
        <CandleLoader3D label="Checking your session…" tone="mixed" />
      </div>
    );
  }

  if (user === null) {
    return (
      <>
        <MoneyRainBackground />
        <div className="app-shell app-shell--centered">
          <Login />
        </div>
      </>
    );
  }

  return (
    <>
      <MoneyRainBackground />
      <div className="app-shell">
        <header className="app-header">
          <p className="app-header__eyebrow">Realized Gains Ledger</p>
          <h1 className="app-header__title">
            Know what you <em>owe</em>, before it's owed.
          </h1>
          <p className="app-header__subtitle">
            Upload your trade history and get an instant, cost-basis-matched breakdown of
            short- and long-term gains — a working estimate, not a filing.
          </p>
          <LiveTicker symbols={['BTC', 'ETH', 'SOL']} />
        </header>

        {!transactions ? (
          <UploadCSV onParsed={handleParsed} />
        ) : (
          <div className="workspace">
            <div className="workspace__toolbar">
              <span className="workspace__toolbar-title">
                {ledger.summary.transactionCount} transactions loaded
              </span>
              <span className="workspace__save-status">
                {saveStatus === 'saving' && 'Saving…'}
                {saveStatus === 'saved' && 'Saved to your account'}
                {saveStatus === 'error' && `Save failed: ${saveError}`}
              </span>
              <button className="workspace__reset" onClick={handleReset}>
                Upload a different file
              </button>
            </div>

            <TaxMethodSelector value={taxMethod} onChange={setTaxMethod} />

            <TransactionCards3D rows={ledger.rows} />

            <ClassifiedTransactions3D transactions={ledger.rows} />

            <Charts3D rows={ledger.rows} />

            <TaxSummary summary={ledger.summary} />

            <ProofOfExistenceSeal
              transactions={ledger.rows}
              summary={ledger.summary}
              uid={user.uid}
            />

            <ExportPackage
              transactions={ledger.rows}
              summary={ledger.summary}
              taxMethod={taxMethod}
            />
          </div>
        )}
      </div>
    </>
  );
}
