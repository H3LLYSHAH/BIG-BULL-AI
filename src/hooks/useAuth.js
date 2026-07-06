cd /home/claude/BIG-BULL-AI && cat > src/hooks/useAuth.js << 'EOF'
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

/**
 * useAuth
 * -------
 * Returns:
 *   undefined  -> still checking (show a loading state)
 *   null       -> signed out
 *   User       -> signed-in Supabase user object (use user.id, not user.uid)
 */
export function useAuth() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return user;
}
EOF
echo "done"
