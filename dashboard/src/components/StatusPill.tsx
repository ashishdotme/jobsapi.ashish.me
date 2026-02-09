import clsx from 'clsx'

export const StatusPill = ({ status }: { status: string }) => {
  const base = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide'

  return (
    <span
      className={clsx(
        base,
        status === 'completed' && 'border-good/25 bg-good/10 text-good',
        status === 'success' && 'border-good/25 bg-good/10 text-good',
        status === 'processing' && 'border-accent2/25 bg-accent2/10 text-accent2',
        status === 'queued' && 'border-border bg-surface2/60 text-muted',
        status === 'partial' && 'border-warn/25 bg-warn/10 text-warn',
        status === 'failed' && 'border-bad/25 bg-bad/10 text-bad',
        status === 'skipped' && 'border-accent/25 bg-accent/10 text-accent',
        status === 'pending' && 'border-border bg-surface2/60 text-muted',
      )}
    >
      {status}
    </span>
  )
}
