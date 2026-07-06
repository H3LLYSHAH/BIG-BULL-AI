import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * saveSession
 * -----------
 * Persists one CSV-upload session under:
 *   users/{uid}/sessions/{sessionId}   (Firestore doc)
 *     - csv:           { path, name } | null  — pointer to the raw file in Storage
 *     - transactions:  parsed rows (dates stored as ISO strings — Firestore
 *                       doesn't natively store JS Date objects the way you'd want)
 *     - summary:       the computed tax summary (shortTermGain, longTermGain, etc.)
 *
 * The raw CSV itself lives in Storage at:
 *   users/{uid}/uploads/{sessionId}-{originalFileName}
 *
 * Call this once you have all three pieces for a session (typically from a
 * useEffect that fires whenever `ledger` changes in App.jsx).
 */
export async function saveSession(uid, sessionId, { csvFile, rows, summary }) {
  let csvMeta = null;

  if (csvFile) {
    const path = `users/${uid}/uploads/${sessionId}-${csvFile.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, csvFile);
    csvMeta = { path, name: csvFile.name };
  }

  const sessionDoc = doc(db, 'users', uid, 'sessions', sessionId);
  await setDoc(
    sessionDoc,
    {
      csv: csvMeta,
      transactions: rows.map((r) => ({
        ...r,
        date: r.date instanceof Date ? r.date.toISOString() : r.date,
      })),
      summary,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
