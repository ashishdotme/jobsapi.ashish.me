import type { ReactNode } from 'react'

export const StatCard = ({ label, value, tone }: { label: string; value: ReactNode; tone: 'neutral' | 'good' | 'warn' | 'bad' }) => {
  const toneClass =
    tone === 'good'
      ? 'border-good/20 bg-good/10 text-good'
      : tone === 'warn'
        ? 'border-warn/20 bg-warn/10 text-warn'
        : tone === 'bad'
          ? 'border-bad/20 bg-bad/10 text-bad'
          : 'border-border bg-surface2/60 text-ink/80'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</div>
    </div>
  )
}
