import { Link } from 'react-router'
import { cn } from '@/components/cn'
import { screenById, studyPath } from '@/routes/screens'
import { TabBadge } from '../a2/ui'

export type AnalysisTabKey = 'codebook' | 'signals' | 'report'

/**
 * The three steps of Results Analysis as tabs, each with how many things are still to review there. Built to be used on A1, A2 and A3;
 * for now only A3 mounts it (the step cards stay elsewhere, see OPEN_QUESTIONS #293).
 */
export function AnalysisTabs({ studyId, current, counts }: { studyId: string; current: AnalysisTabKey; counts: Record<AnalysisTabKey, number> }) {
  const tabs: { key: AnalysisTabKey; label: string; to: string; what: string }[] = [
    { key: 'codebook', label: 'Codebook', to: studyPath(studyId, screenById.A1), what: 'codes to review' },
    { key: 'signals', label: 'Emotion & behaviour', to: studyPath(studyId, screenById.A2), what: 'insights to review' },
    { key: 'report', label: 'Report', to: studyPath(studyId, screenById.A3), what: 'blocks to review' },
  ]
  return (
    <nav aria-label="Analysis steps" data-testid="analysis-tabs" className="flex gap-1 border-b border-mist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          aria-current={t.key === current ? 'page' : undefined}
          data-tab={t.key}
          className={cn('-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium', t.key === current ? 'border-ink text-ink' : 'border-transparent text-graphite hover:bg-haze hover:text-ink')}
        >
          {t.label}
          <TabBadge n={counts[t.key]} label={t.what} testid={`tab-badge-${t.key}`} />
        </Link>
      ))}
    </nav>
  )
}
