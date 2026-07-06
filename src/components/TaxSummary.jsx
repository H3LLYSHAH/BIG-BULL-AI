const currency = (value) =>
  value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
// Flat placeholder rates used only to illustrate order of magnitude —
// actual liability depends on income, filing status, and jurisdiction.
const ASSUMED_SHORT_TERM_RATE = 0.24;
const ASSUMED_LONG_TERM_RATE = 0.15;

export default function TaxSummary({ summary }) {
  const { shortTermGain, longTermGain, totalGain, totalFees } = summary;

  const estimatedTax =
    Math.max(shortTermGain, 0) * ASSUMED_SHORT_TERM_RATE +
    Math.max(longTermGain, 0) * ASSUMED_LONG_TERM_RATE;

  return (
    <div className="summary-card">
      <span className="summary-card__stamp">Estimate</span>
      <h2 className="summary-card__title">Tax Summary</h2>
      <p className="summary-card__year">Based on uploaded activity</p>

      <div className="summary-card__row">
        <span className="summary-card__row-label">Short-term gain</span>
        <span className="summary-card__row-value">{currency(shortTermGain)}</span>
      </div>
      <div className="summary-card__row">
        <span className="summary-card__row-label">Long-term gain</span>
        <span className="summary-card__row-value">{currency(longTermGain)}</span>
      </div>
      <div className="summary-card__row">
        <span className="summary-card__row-label">Fees paid</span>
        <span className="summary-card__row-value">{currency(totalFees)}</span>
      </div>
      <div className="summary-card__row">
        <span className="summary-card__row-label">Est. tax owed*</span>
        <span className="summary-card__row-value">{currency(estimatedTax)}</span>
      </div>

      <div className="summary-card__row summary-card__row--total">
        <span className="summary-card__row-label">Net realized</span>
        <span
          className="summary-card__row-value"
          style={{ color: totalGain >= 0 ? 'var(--profit)' : 'var(--loss)' }}
        >
          {totalGain >= 0 ? '+' : ''}
          {currency(totalGain)}
        </span>
      </div>

      <p className="summary-card__disclaimer">
        *Assumes flat placeholder rates ({Math.round(ASSUMED_SHORT_TERM_RATE * 100)}% short-term,{' '}
        {Math.round(ASSUMED_LONG_TERM_RATE * 100)}% long-term) applied only to gains, ignoring
        income bracket, losses carried forward, and jurisdiction. This is a rough planning figure,
        not tax advice — check with a tax professional before filing.
      </p>
    </div>
  );
}
