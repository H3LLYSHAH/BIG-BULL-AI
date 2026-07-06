import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * useAuth
 * -------
 * Returns:
 *   undefined  -> still checking (show a loading state)
 *   null       -> signed out
 *   User       -> signed-in Firebase user object
 */
export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  return user;
}
