import { formatDate } from '@/lib/format'
import type { StudyRecord } from '@/mock/types'
import { SECTION_KEYS, sectionMeta, type BriefDoc, type BriefVersion } from '@/state/brief'

// The formatted brief the client receives. Printed as the "PDF" via the browser's print dialog.
export function BriefDocument({ study, doc, version }: { study: StudyRecord; doc: BriefDoc; version: BriefVersion }) {
  const aiSections = SECTION_KEYS.filter((k) => version.sections[k].source === 'AI-generated')
  return (
    <article className="print-area rounded-md border border-mist bg-surface px-8 py-8 sm:px-10">
      <header className="border-b border-mist pb-5">
        <p className="text-sm text-graphite">Research brief</p>
        <h2 className="mt-1 text-xl font-semibold">{study.name}</h2>
        <p className="mt-1 text-sm text-graphite">
          {study.client !== 'Client not set' ? `${study.client}. ` : ''}Version {version.number}, {formatDate(version.savedAt)}
        </p>
      </header>
      <div className="flex flex-col gap-6 pt-6">
        {SECTION_KEYS.map((k) => {
          const s = version.sections[k]
          return (
            <section key={k} className="break-inside-avoid">
              <h3 className="text-md font-semibold">{sectionMeta[k].title}</h3>
              {s.text ? (
                <p className="mt-1 max-w-prose whitespace-pre-wrap">{s.text}</p>
              ) : (
                <p className="mt-1 text-graphite italic">Not provided yet.</p>
              )}
              {s.source === 'AI-generated' && (
                <p className="mt-1 text-xs text-graphite">
                  {doc.draft?.[k].aiLabel ?? 'AI-generated'}
                  {s.aiAccepted ? ', reviewed by the researcher.' : ', not yet reviewed by the researcher.'}
                </p>
              )}
            </section>
          )
        })}
      </div>
      {aiSections.some((k) => doc.draft?.[k].sources?.length) && (
        <footer className="mt-8 border-t border-mist pt-4">
          <h3 className="text-sm font-semibold">Web scan sources</h3>
          <ul className="mt-1 flex flex-col gap-1 text-xs text-graphite">
            {aiSections.flatMap((k) => doc.draft?.[k].sources ?? []).map((src) => (
              <li key={src.url}>
                {src.title}, {src.publisher}. {src.url}
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  )
}
