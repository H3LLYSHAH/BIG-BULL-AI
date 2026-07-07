import { useEffect, useMemo, useState } from 'react';
import MoneyRainBackground from './components/MoneyRainBackground';
import WalletManager from './components/WalletManager';
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
import { useLivePrices } from './hooks/useLivePrices';
import { saveSession } from './lib/saveSession';
import { computeLedger, computeOpenPositions } from './lib/costBasisMethods';
import ChatbotWidget from "./components/ChatbotWidget";
import './theme.css';

export default function App() {
  const user = useAuth();

  const [wallets, setWallets] = useState([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [taxMethod, setTaxMethod] = useState('FIFO');

  const combinedRows = useMemo(
    () =>
      wallets
        .filter((w) => w.included)
        .flatMap((w) => w.rows.map((r) => ({ ...r, walletId: w.id, walletLabel: w.label }))),
    [wallets]
  );

  const ledger = useMemo(
    () => (combinedRows.length ? computeLedger(combinedRows, taxMethod) : null),
    [combinedRows, taxMethod]
  );

  const openPositions = useMemo(
    () => (combinedRows.length ? computeOpenPositions(combinedRows, taxMethod) : []),
    [combinedRows, taxMethod]
  );

  const heldSymbols = useMemo(() => openPositions.map((p) => p.asset), [openPositions]);
  const livePrices = useLivePrices(heldSymbols.length ? heldSymbols : ['BTC', 'ETH', 'SOL']);

  const chatbotPortfolio = useMemo(
    () =>
      openPositions
        .filter((p) => livePrices[p.asset])
        .map((p) => ({
          asset: p.asset,
          quantity: p.quantity,
          avgBuyPrice: p.avgBuyPrice,
          currentPrice: livePrices[p.asset].price,
        })),
    [openPositions, livePrices]
  );

  function handleReset() {
    setWallets([]);
    setSaveStatus('idle');
    setSaveError(null);
  }

  useEffect(() => {
    if (!user || !ledger) return;
    let cancelled = false;

    (async () => {
      setSaveStatus('saving');
      setSaveError(null);
      try {
        await saveSession(user.id, sessionId, {
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
        <CandleLoader3D label="Checking your session..." tone="mixed" />
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
            The most expensive thing in the world is <em>trust</em>.
            <br />
            Cheap people can't afford it.
          </h1>
          <p className="app-header__subtitle">
            Add one or more wallets and get an instant, cost-basis-matched breakdown of
            short- and long-term gains across all of them - a working estimate, not a filing.
          </p>
          <LiveTicker symbols={['BTC', 'ETH', 'SOL']} />
        </header>

        <WalletManager taxMethod={taxMethod} onWalletsChange={setWallets} />

        {ledger && (
          <div className="workspace">
            <div className="workspace__toolbar">
              <span className="workspace__toolbar-title">
                {ledger.summary.transactionCount} transactions across{' '}
                {wallets.filter((w) => w.included).length} wallet
                {wallets.filter((w) => w.included).length === 1 ? '' : 's'}
              </span>
              <span className="workspace__save-status">
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved to your account'}
                {saveStatus === 'error' && `Save failed: ${saveError}`}
              </span>
              <button className="workspace__reset" onClick={handleReset}>
                Clear all wallets
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

        <ChatbotWidget portfolio={chatbotPortfolio} />
      </div>
    </>
  );
}
