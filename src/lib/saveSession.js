import { supabase } from '../supabase';

/**
 * saveSession
 * -----------
 * Persists one CSV-upload session into the `sessions` table:
 *   - user_id:      the signed-in user's id (auth.users.id)
 *   - session_id:   client-generated id for this session
 *   - csv_path:     pointer to the raw file in Supabase Storage (or null)
 *   - csv_name:     original file name (or null)
 *   - transactions: parsed rows (JSON column)
 *   - summary:      computed tax summary (JSON column)
 *   - updated_at:   set automatically
 *
 * The raw CSV itself lives in the `uploads` Storage bucket at:
 *   {user_id}/{sessionId}-{originalFileName}
 *
 * Requires a `sessions` table and an `uploads` storage bucket in Supabase,
 * both with Row Level Security restricting access to auth.uid() = user_id.
 */
export async function saveSession(userId, sessionId, { csvFile, rows, summary }) {
  let csvPath = null;
  let csvName = null;

  if (csvFile) {
    const path = `${userId}/${sessionId}-${csvFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, csvFile, { upsert: true });
    if (uploadError) throw uploadError;
    csvPath = path;
    csvName = csvFile.name;
  }

  const { error } = await supabase.from('sessions').upsert(
    {
      user_id: userId,
      session_id: sessionId,
      csv_path: csvPath,
      csv_name: csvName,
      transactions: rows.map((r) => ({
        ...r,
        date: r.date instanceof Date ? r.date.toISOString() : r.date,
      })),
      summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,session_id' }
  );

  if (error) throw error;
}
