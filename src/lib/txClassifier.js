import * as tf from '@tensorflow/tfjs';

/**
 * txClassifier
 * ------------
 * Guesses a transaction's likely *nature* — swap, fee, staking_reward,
 * transfer, or ordinary trade — as a helper label shown next to each row.
 * It NEVER changes cost basis, proceeds, or tax numbers; those still come
 * entirely from the FIFO logic in App.jsx. This is advisory only.
 *
 * Why synthetic training data: there's no labeled dataset shipped with the
 * app, and pulling one over the network isn't reliable for a client-side
 * demo. Instead we generate examples FROM the same heuristics a human would
 * use (tiny quantity + zero price = fee, round recurring small buys = staking,
 * etc.), then train a small model on those so predictions come with a
 * genuine confidence score instead of a hard-coded if/else chain. Treat this
 * as a reasonable starting model — swap in real labeled history later for
 * better accuracy.
 */

export const TX_TYPES = ['trade', 'swap', 'fee', 'staking_reward', 'transfer'];

let model = null;
let trainingPromise = null;

function synthesizeExamples(n = 1200) {
  const X = [];
  const Y = [];
  const pushExample = (features, typeIndex) => {
    X.push(features);
    const label = new Array(TX_TYPES.length).fill(0);
    label[typeIndex] = 1;
    Y.push(label);
  };

  for (let i = 0; i < n; i++) {
    const r = Math.random();
    // features: [log(quantity), log(price+1), feeRatio, isRoundQty, isTinyQty]
    if (r < 0.3) {
      // ordinary trade: meaningful quantity, real price, normal fee ratio
      const qty = 0.05 + Math.random() * 5;
      const price = 50 + Math.random() * 70000;
      const fee = price * qty * (0.0005 + Math.random() * 0.002);
      pushExample(features(qty, price, fee), TX_TYPES.indexOf('trade'));
    } else if (r < 0.5) {
      // swap: similar to trade but often smaller, higher relative fee
      const qty = 0.1 + Math.random() * 3;
      const price = 20 + Math.random() * 5000;
      const fee = price * qty * (0.001 + Math.random() * 0.004);
      pushExample(features(qty, price, fee), TX_TYPES.indexOf('swap'));
    } else if (r < 0.65) {
      // fee: tiny quantity, price can be anything, fee IS basically the row
      const qty = 0.0001 + Math.random() * 0.01;
      const price = 10 + Math.random() * 60000;
      const fee = price * qty * (0.8 + Math.random() * 0.2);
      pushExample(features(qty, price, fee), TX_TYPES.indexOf('fee'));
    } else if (r < 0.85) {
      // staking reward: small, often round-ish quantity, zero/near-zero fee
      const qty = 0.001 + Math.random() * 0.5;
      const price = 20 + Math.random() * 5000;
      const fee = 0;
      pushExample(features(qty, price, fee), TX_TYPES.indexOf('staking_reward'));
    } else {
      // transfer: price is 0 (moving your own coins, not a taxable event)
      const qty = 0.01 + Math.random() * 10;
      const price = 0;
      const fee = Math.random() < 0.5 ? Math.random() * 5 : 0;
      pushExample(features(qty, price, fee), TX_TYPES.indexOf('transfer'));
    }
  }
  return { X, Y };
}

function features(quantity, price, fee) {
  const logQty = Math.log(quantity + 1e-8);
  const logPrice = Math.log(price + 1);
  const feeRatio = price * quantity > 0 ? fee / (price * quantity) : fee > 0 ? 1 : 0;
  const isRoundQty = Math.abs(quantity - Math.round(quantity * 100) / 100) < 1e-6 ? 1 : 0;
  const isTinyQty = quantity < 0.01 ? 1 : 0;
  return [logQty, logPrice, feeRatio, isRoundQty, isTinyQty];
}

function buildModel() {
  const m = tf.sequential();
  m.add(tf.layers.dense({ inputShape: [5], units: 16, activation: 'relu' }));
  m.add(tf.layers.dense({ units: 12, activation: 'relu' }));
  m.add(tf.layers.dense({ units: TX_TYPES.length, activation: 'softmax' }));
  m.compile({ optimizer: tf.train.adam(0.01), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return m;
}

/**
 * Trains once (a few hundred ms in-browser) and caches the model in memory
 * for the rest of the session. Safe to call repeatedly — subsequent calls
 * reuse the same trained model.
 */
export async function ensureModelTrained() {
  if (model) return model;
  if (trainingPromise) return trainingPromise;

  trainingPromise = (async () => {
    const { X, Y } = synthesizeExamples();
    const xs = tf.tensor2d(X);
    const ys = tf.tensor2d(Y);
    const m = buildModel();
    await m.fit(xs, ys, { epochs: 18, batchSize: 32, shuffle: true, verbose: 0 });
    xs.dispose();
    ys.dispose();
    model = m;
    return m;
  })();

  return trainingPromise;
}

/**
 * classifyTransactions(rows)
 * rows: [{ quantity, price, fee }] (fee optional, defaults to 0)
 * Returns rows with `.predictedType` and `.confidence` (0-1) attached.
 * Does not mutate the input array.
 */
export async function classifyTransactions(rows) {
  const m = await ensureModelTrained();
  if (!rows.length) return [];

  const X = rows.map((r) => features(r.quantity, r.price, r.fee || 0));
  const xs = tf.tensor2d(X);
  const preds = m.predict(xs);
  const values = await preds.array();
  xs.dispose();
  preds.dispose();

  return rows.map((r, i) => {
    const probs = values[i];
    let bestIdx = 0;
    for (let j = 1; j < probs.length; j++) if (probs[j] > probs[bestIdx]) bestIdx = j;
    return { ...r, predictedType: TX_TYPES[bestIdx], confidence: probs[bestIdx] };
  });
}
