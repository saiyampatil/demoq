import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { controlBase } from '@/components/Field'
import { StatusChip } from '@/components/StatusChip'
import { formatStamp } from '@/lib/format'
import { screenById, studyPath } from '@/routes/screens'
import { consentSummary, participantsOf, type Session } from '@/state/fieldwork'
import type { FWProps } from './FieldworkBits'

const yes = (b: boolean) => (b ? 'Yes' : 'No')
const stateOf = (s: Session) => (s.consent?.withdrawn ? 'Withdrawn' : s.consent ? 'On record' : 'Not yet')

export function ConsentTab({ doc, studyId }: FWProps) {
  const [filter, setFilter] = useState('')
  const sum = consentSummary(doc)
  // Consent is given once per participant, in their first session.
  const rows = participantsOf(doc).map((p) => p.first).filter((s) => !filter || stateOf(s) === filter)

  const exportCsv = () => {
    const head = ['Participant', 'Contact', 'State', 'Consented at', 'Wording', 'Recording', 'AI moderator', 'Data use', 'Recontact', '18 or older', 'Device', 'Withdrawn at', 'Withdrawal reason']
    const lines = participantsOf(doc).map((p) => p.first).map((s) => {
      const c = s.consent
      return [s.participantId, s.ref, stateOf(s), c?.at ?? '', c?.wording ?? '', c ? yes(c.recording) : '', c ? yes(c.aiModerator) : '', c ? yes(c.dataUse) : '', c ? yes(c.recontact) : '', c ? yes(c.over18) : '', c?.device ?? '', c?.withdrawn?.at ?? '', c?.withdrawn?.reason ?? '']
    })
    const csv = [head, ...lines].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `consent-log-${doc.releaseVersion.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Consent summary" className="grid grid-cols-2 gap-4 rounded-md border border-mist bg-surface p-5 sm:grid-cols-4">
        {(
          [
            ['Consent on record', sum.given],
            ['Withdrawn', sum.withdrawn],
            ['Not yet consented', sum.pending],
            ['Agreed to recontact', `${sum.recontactPct}%`],
          ] as const
        ).map(([l, n]) => (
          <div key={l}>
            <p className="text-sm text-graphite">{l}</p>
            <p className="text-xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </section>

      <p className="text-sm text-graphite">
        Participants agreed to the wording <span className="font-medium text-ink">{doc.consentWording}</span>, under {doc.releaseVersion}. Consent is asked before booking and isn’t asked again at the interview. A withdrawal stops the session and is kept on record.
      </p>

      <Card
        title="Consent log"
        flush
        actions={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-graphite">Show</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(controlBase, 'h-8 pr-7 text-sm')}>
                <option value="">All</option>
                <option>On record</option>
                <option>Withdrawn</option>
                <option>Not yet</option>
              </select>
            </label>
            <Button size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Consent records</caption>
            <thead>
              <tr className="border-b border-mist bg-haze text-graphite">
                {['Participant', 'Contact', 'Consent', 'When', 'Recording', 'AI moderator', 'Data use', 'Recontact', '18+', 'Device'].map((h) => (
                  <th key={h} scope="col" className="h-9 px-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const c = s.consent
                return (
                  <tr key={s.id} className="border-b border-mist align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <Link to={studyPath(studyId, { ...screenById.R19, path: screenById.R19.path.replace(':sessionId', s.id) })} className="font-medium tabular-nums text-iris-700 hover:underline">
                        {s.participantId}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{s.ref}</td>
                    <td className="px-3 py-2.5">
                      {c ? <StatusChip status={c.withdrawn ? 'Withdrawn' : 'Consented'} size="sm" /> : <span className="text-graphite">Not yet</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {c ? formatStamp(c.at) : <span className="text-muted">—</span>}
                      {c?.withdrawn && <span className="mt-0.5 block text-xs text-pending-fg">Withdrawn {formatStamp(c.withdrawn.at)}</span>}
                    </td>
                    <td className="px-3 py-2.5">{c ? yes(c.recording) : '—'}</td>
                    <td className="px-3 py-2.5">{c ? (c.aiModerator ? 'Yes' : 'Not used') : '—'}</td>
                    <td className="px-3 py-2.5">{c ? yes(c.dataUse) : '—'}</td>
                    <td className="px-3 py-2.5">{c ? yes(c.recontact) : '—'}</td>
                    <td className="px-3 py-2.5">{c ? yes(c.over18) : '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-graphite">{c?.device ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
