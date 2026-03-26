import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Workflow, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { to: '/',           label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/workflows',  label: 'Workflows', icon: Workflow },
  { to: '/settings',   label: 'Settings',  icon: Settings },
];

export function AppLayout() {
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-4 border-b border-zinc-800">
          <span className="flex size-6 items-center justify-center rounded bg-indigo-600 text-xs font-bold text-white">
            CI
          </span>
          <span className="text-sm font-semibold text-zinc-100">CI Runner</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="text-xs text-zinc-600">v1.0.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
