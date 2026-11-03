import { Button } from '@/components/Button'
import { AIGeneratedTag } from '@/components/AIGenerated'
import { controlBase } from '@/components/Field'
import { cn } from '@/components/cn'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip } from '@/components/StatusChip'
import { formatDateTime } from '@/lib/format'
import { now } from '@/state/brief'
import { consentTemplate, EXTRA_LANGUAGES, editSetup, supportedLanguages, type LaunchDoc } from '@/state/launch'

type Props = {
  open: boolean
  onClose: () => void
  client: string
  /** The study language, from the brief. Read only here. */
  language: string | null
  launch: LaunchDoc | undefined
  me: string
  update: (fn: (d: LaunchDoc) => LaunchDoc) => void
}

/**
 * Consent wording, languages, translations, links and the fieldwork window. No earlier module owns these,
 * so they sit here for now; the Study settings screen (R23, Phase 9) takes them over.
 */
export function SetupDrawer({ open, onClose, client, language, launch, me, update }: Props) {
  const setup = launch?.setup
  const langs = supportedLanguages(language, launch)
  const primary = language
  const edit = (fn: Parameters<typeof editSetup>[1]) => update((d) => editSetup(d, fn))

  return (
    <SideDrawer open={open} onClose={onClose} title="Study setup" description="Values the launch checks read. Changing them doesn’t create a new guide version.">
      <div className="flex flex-col gap-7">
        <section aria-label="Fieldwork window">
          <h3 className="mb-2 text-md font-semibold">Fieldwork window</h3>
          <div className="flex flex-wrap gap-3">
            {(['start', 'end'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1 text-sm">
                <span className="text-graphite">{k === 'start' ? 'Starts' : 'Ends'}</span>
                <input
                  type="date"
                  value={setup?.fieldwork?.[k] ?? ''}
                  onChange={(e) => edit((s) => ({ ...s, fieldwork: { start: s.fieldwork?.start ?? e.target.value, end: s.fieldwork?.end ?? e.target.value, [k]: e.target.value } }))}
                  className={cn(controlBase, 'h-9')}
                />
              </label>
            ))}
          </div>
        </section>

        <section aria-label="Languages">
          <h3 className="mb-2 text-md font-semibold">Languages</h3>
          <ul className="flex flex-col gap-1.5">
            {langs.map((l) => (
              <li key={l} className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {l}
                  {l === primary && <span className="ml-2 text-graphite">from your market</span>}
                </span>
                {l !== primary && (
                  <Button size="sm" variant="ghost" onClick={() => edit((s) => ({ ...s, extraLanguages: s.extraLanguages.filter((x) => x !== l) }))}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {EXTRA_LANGUAGES.filter((l) => !langs.includes(l)).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {EXTRA_LANGUAGES.filter((l) => !langs.includes(l)).map((l) => (
                <Button key={l} size="sm" onClick={() => edit((s) => ({ ...s, extraLanguages: [...s.extraLanguages, l] }))}>
                  Add {l}
                </Button>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Consent wording">
          <h3 className="mb-2 text-md font-semibold">Consent wording</h3>
          <ul className="flex flex-col gap-3">
            {langs.map((l) => {
              const c = setup?.consent[l]
              return (
                <li key={l} className="rounded-sm border border-mist p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l}</span>
                    {c?.origin === 'ai' && <AIGeneratedTag />}
                    <span className="flex-1" />
                    <StatusChip status={c?.approved ? 'Approved' : 'Draft'} size="sm" />
                  </div>
                  {c ? <p className="text-graphite">{c.text}</p> : <p className="text-pending-fg">No wording for this language yet.</p>}
                  {c?.approved && c.by && <p className="mt-1 text-xs text-graphite">Approved by {c.by}, {formatDateTime(c.at!)}</p>}
                  <div className="mt-2 flex gap-2">
                    {!c && (
                      <Button
                        size="sm"
                        onClick={() => edit((s) => ({ ...s, consent: { ...s.consent, [l]: { text: consentTemplate(l, client), approved: false, origin: l === primary ? 'researcher' : 'ai' } } }))}
                      >
                        {l === primary ? 'Use standard wording' : 'Draft with AI'}
                      </Button>
                    )}
                    {c && !c.approved && (
                      <Button size="sm" variant="primary" onClick={() => edit((s) => ({ ...s, consent: { ...s.consent, [l]: { ...c, approved: true, by: me, at: now() } } }))}>
                        Approve wording
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {langs.length > 1 && (
          <section aria-label="Translations">
            <h3 className="mb-2 text-md font-semibold">Translations</h3>
            <ul className="flex flex-col gap-2">
              {langs.slice(1).map((l) => (
                <li key={l} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1">{l}</span>
                  {setup?.translated[l] ? (
                    <span className="flex items-center gap-2 text-positive-fg">
                      <AIGeneratedTag /> Translated
                    </span>
                  ) : (
                    <>
                      <span className="text-pending-fg">Not translated</span>
                      <Button size="sm" onClick={() => edit((s) => ({ ...s, translated: { ...s.translated, [l]: true } }))}>
                        Translate with AI
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Links">
          <h3 className="mb-2 text-md font-semibold">Links</h3>
          <ul className="flex flex-col gap-1.5">
            {(setup?.links ?? []).map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  {l.label}
                  <span className="block truncate text-xs text-graphite">{l.url}</span>
                </span>
                {l.ok ? (
                  <span className="text-positive-fg">Opens</span>
                ) : (
                  <>
                    <span className="text-pending-fg">Doesn’t open</span>
                    <Button size="sm" onClick={() => edit((s) => ({ ...s, links: s.links.map((x) => (x.id === l.id ? { ...x, ok: true } : x)) }))}>
                      Check again
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SideDrawer>
  )
}
