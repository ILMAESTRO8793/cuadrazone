import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";
export function useAuth() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { enabled: ready, retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation();
  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();
  }, [logoutMutation, utils]);
  return { user: me.data ?? null, ready, loading: !ready || me.isLoading || logoutMutation.isPending, error: me.error ?? logoutMutation.error, isAuthenticated: Boolean(me.data), refresh: me.refetch, logout };
}
