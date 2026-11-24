import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useStudies } from '@/state/StudyContext'
import { approveBlock, ensureReport, isCurrentReport, leaveOutBlock, REPORT_USER, reopenBlock, restoreDecision, updateReport, useReport, type BlockDecision } from '@/state/report'
import { reportModel, type Block } from '@/state/reportBlocks'
import { reportInputs } from '@/state/reportInputs'
import { applyA2Accepted, FIXTURE_PARAM, FIXTURE_VALUE } from '@/state/reportFixture'
import { useAnalysis } from './useAnalysis'

/**
 * The A3 report for the open study: its blocks, their counts, and the actions on a block. Footer, rail dots and tab badges all read
 * `model.counts`, so they always agree. Dev only: `?fixture=a2-accepted` accepts everything in A2 through the real functions.
 */
export function useReportModel() {
  const a = useAnalysis()
  const { getBrief, getGuide } = useStudies()
  const [params] = useSearchParams()
  const saved = useReport(a.studyId)
  const report = isCurrentReport(saved) ? saved : undefined
  const fixture = import.meta.env.DEV && params.get(FIXTURE_PARAM) === FIXTURE_VALUE

  // The report is made the first time, and an older shape is replaced. In an effect, never in render.
  useEffect(() => {
    if (a.ready) ensureReport(a.studyId)
  }, [a.ready, a.studyId])

  // The dev fixture. useAnalysis puts the seed's own decisions in first (its effect runs before this one).
  useEffect(() => {
    if (fixture && a.ready && a.doc) applyA2Accepted(a.studyId, a.basis, a.me ?? REPORT_USER)
    // Once per page load: the codebook changes as it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, a.ready, a.studyId])

  const inputs = useMemo(
    () => reportInputs({ studyId: a.studyId, client: a.study?.client, brief: getBrief(a.studyId), guide: getGuide(a.studyId), basis: a.basis, excluded: a.review.filter((r) => r.status === 'Excluded').length }),
    [a.studyId, a.study, getBrief, getGuide, a.basis, a.review],
  )
  const model = useMemo(() => (a.doc ? reportModel({ studyId: a.studyId, doc: a.doc, basis: a.basis, inputs, report }) : undefined), [a.studyId, a.doc, a.basis, inputs, report])

  const by = a.me ?? REPORT_USER
  const find = useCallback((id: string) => model?.blocks.find((b) => b.id === id), [model])
  const act = useMemo(
    () => ({
      /** Approve a block as it reads now, or approve it again when it is Out of date. Returns what it had before, for Undo. */
      approve: (b: Block): BlockDecision | undefined => {
        const prev = report?.decisions[b.id]
        updateReport(a.studyId, (d) => approveBlock(d, b, { by }))
        return prev
      },
      leaveOut: (b: Block, reason?: string): BlockDecision | undefined => {
        const prev = report?.decisions[b.id]
        updateReport(a.studyId, (d) => leaveOutBlock(d, b, { by }, reason))
        return prev
      },
      reopen: (id: string) => updateReport(a.studyId, (d) => reopenBlock(d, id, { by })),
      undo: (id: string, prev: BlockDecision | undefined) => updateReport(a.studyId, (d) => restoreDecision(d, id, prev, { by })),
    }),
    [a.studyId, by, report],
  )
  return { ...a, report, inputs, model, act, find, fixture }
}
