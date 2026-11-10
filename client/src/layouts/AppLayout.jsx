import { Leaf, LogOut } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { Button } from '../components/common/Button.jsx';
import { ViewToggle } from '../components/common/ViewToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function AppLayout() {
  const { agent, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-brand-700 p-1.5 text-white">
              <Leaf className="size-4" aria-hidden />
            </span>
            <span className="hidden text-sm font-semibold sm:inline">Verdant &amp; Co Support</span>
          </div>

          <ViewToggle />

          <div className="flex min-w-0 items-center justify-end gap-2 sm:min-w-40">
            {agent && (
              <>
                <span className="hidden truncate text-sm text-stone-500 md:inline">{agent.name}</span>
                <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} aria-label="Sign out">
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
