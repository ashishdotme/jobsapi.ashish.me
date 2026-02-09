import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import type { ReactNode } from 'react'

const navItems = [
  { to: '/', label: 'Upload', hint: 'CSV Ingestion' },
  { to: '/jobs', label: 'Jobs', hint: 'History & Status' },
  { to: '/settings', label: 'Settings', hint: 'API Key' },
]

export const AdminLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen text-ink">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] grid-cols-1 gap-4 p-4 md:grid-cols-[300px_1fr] md:p-8">
        <aside className="ui-card p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-muted">JobsAPI</div>
              <div className="h-2 w-16 rounded-full bg-[repeating-linear-gradient(90deg,rgba(249,115,22,0.95)_0px,rgba(249,115,22,0.95)_8px,rgba(14,165,233,0.75)_8px,rgba(14,165,233,0.75)_16px)]" />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Operations Console</h1>
            <p className="mt-2 text-sm text-muted">Bulk import command center for movies and shows.</p>
          </div>

          <nav className="space-y-1.5">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'group block rounded-2xl border px-4 py-3 transition',
                    isActive
                      ? 'border-accent/30 bg-accent/10'
                      : 'border-border/80 bg-surface/40 hover:border-accent/25 hover:bg-surface/70',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-ink">{item.label}</div>
                      <div
                        className={clsx(
                          'h-2 w-2 rounded-full border transition',
                          isActive ? 'border-accent bg-accent/60' : 'border-border bg-surface2 group-hover:border-accent/40',
                        )}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted">{item.hint}</div>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-border/80 bg-surface2/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Hint</div>
            <div className="mt-2 text-sm text-ink/85">
              Upload CSV, watch rows stream in, retry failures. Keep your API key in <span className="font-mono text-[12px]">Settings</span>.
            </div>
          </div>
        </aside>

        <main className="ui-card p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
