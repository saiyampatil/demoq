import { useEffect, useState, type ReactNode } from 'react'
import { AIContent, AIGeneratedTag } from '@/components/AIGenerated'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CheckIcon, PlusIcon } from '@/components/icons'
import { Quote } from '@/components/Quote'
import { SideDrawer } from '@/components/SideDrawer'
import { StatusChip, StatusGlyph } from '@/components/StatusChip'
import { EmptyState, ErrorState, LoadingState } from '@/components/States'
import { Stepper, type StepperStep } from '@/components/Stepper'
import { Table, type Column } from '@/components/Table'
import { familyMeaning, statusFamily, vocabularies, vocabularyLabels, type Status, type StatusFamily } from '@/components/status'
import { presetStudy } from '@/mock/moisturizerStudy'
import { stepInfo } from '@/state/workflow'
import { ScreenTag } from '@/apps/shared/ScreenTag'
import { TopBar } from '@/apps/shared/TopBar'

const sections = [
  { id: 'voices', label: 'Three voices' },
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Type' },
  { id: 'space', label: 'Spacing, radii, shadows' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'status', label: 'Status chips' },
  { id: 'ai', label: 'AI-generated content' },
  { id: 'surfaces', label: 'Card, table, drawer' },
  { id: 'states', label: 'Empty, loading, error' },
  { id: 'stepper', label: 'Stepper' },
]

function useToken(name: string) {
  const [value, setValue] = useState('')
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
  }, [name])
  return value
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-mist py-10 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-1 max-w-prose text-graphite">{intro}</p>}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Swatch({ token, note }: { token: string; note?: string }) {
  const value = useToken(`--color-${token}`)
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-sm ring-1 ring-ink/10" style={{ background: `var(--color-${token})` }} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{token}</div>
        <div className="text-xs text-graphite tabular-nums">
          {value.toUpperCase()}
          {note && <span className="text-muted">, {note}</span>}
        </div>
      </div>
    </div>
  )
}

const typeScale = [
  { token: 'xl', use: 'Page titles', sample: 'Moisturizer Concept Study' },
  { token: 'lg', use: 'Section titles, drawer titles', sample: 'Launch readiness' },
  { token: 'md', use: 'Card titles, emphasis', sample: 'Research objectives' },
  { token: 'base', use: 'Body and table text', sample: 'Capture unprompted reactions before any explanation.' },
  { token: 'sm', use: 'Secondary text, chips, buttons (small)', sample: 'Approved by Maya Ortiz on Oct 14, 2026' },
  { token: 'xs', use: 'Meta, hints, screen IDs', sample: 'Unlocks when the brief is Approved' },
]

function TypeRow({ token, use, sample }: { token: string; use: string; sample: string }) {
  const size = useToken(`--text-${token}`)
  const lh = useToken(`--text-${token}--line-height`)
  return (
    <div className="grid gap-1 border-b border-mist py-3 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-6">
      <div>
        <div className="text-sm font-medium">text-{token}</div>
        <div className="text-xs text-graphite tabular-nums">
          {size} / {lh}, {use}
        </div>
      </div>
      <div className="truncate" style={{ fontSize: `var(--text-${token})`, lineHeight: `var(--text-${token}--line-height)` }}>
        {sample}
      </div>
    </div>
  )
}

const families: StatusFamily[] = ['neutral', 'pending', 'progress', 'positive', 'negative', 'held']

type DemoApplicant = { id: string; name: string; segment: string; screening: Status; verification: Status }

const demoApplicants: DemoApplicant[] = [
  { id: 'A-1003', name: 'Rachel Kim', segment: 'Dry skin, 25–34', screening: 'Eligible', verification: 'Passed' },
  { id: 'A-1007', name: 'Monica Alvarez', segment: 'Combination, 35–44', screening: 'Needs Review', verification: 'Pending' },
  { id: 'A-1011', name: 'Tasha Greene', segment: 'Dry skin, 35–44', screening: 'Reserve', verification: 'Passed' },
  { id: 'A-1014', name: 'Lauren Price', segment: 'Oily skin, 25–34', screening: 'Ineligible', verification: 'Not started' },
]

const applicantColumns: Column<DemoApplicant>[] = [
  { key: 'id', header: 'Applicant', cell: (a) => <span className="tabular-nums text-graphite">{a.id}</span> },
  { key: 'name', header: 'Name', cell: (a) => <span className="font-medium">{a.name}</span> },
  { key: 'segment', header: 'Segment', cell: (a) => <span className="text-graphite">{a.segment}</span> },
  { key: 'screening', header: 'Screening', cell: (a) => <StatusChip status={a.screening} /> },
  { key: 'verification', header: 'Verification', cell: (a) => <StatusChip status={a.verification} /> },
]

export function DesignPage() {
  const [drawer, setDrawer] = useState<DemoApplicant | null>(null)
  const demoSteps: StepperStep[] = stepInfo(presetStudy('midway')).map((s) => ({
    ...s,
    to: '#stepper',
    current: s.key === 'guide',
    items:
      s.key === 'guide'
        ? [
            { id: 'R12', name: 'Moderator setup', to: '#stepper', active: false },
            { id: 'R13', name: 'Stimulus library', to: '#stepper', active: false },
            { id: 'R14', name: 'Discussion guide editor', to: '#stepper', active: true },
          ]
        : undefined,
  }))

  return (
    <div className="min-h-screen bg-paper">
      <TopBar home="/researcher" context="Design system" nav={[{ to: '/researcher', label: 'Back to app' }]} />
      <div className="mx-auto flex max-w-content gap-10 px-4 py-10 sm:px-6">
        <nav aria-label="Design sections" className="sticky top-20 hidden h-fit w-48 shrink-0 lg:block">
          <ul className="flex flex-col gap-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-sm px-2 py-1.5 text-sm text-graphite hover:bg-haze hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">
          <header className="mb-10">
            <h1 className="text-xl font-semibold">PulseAI Qual design system</h1>
            <p className="mt-1 max-w-prose text-graphite">
              Every token and shared component in one place. Tokens live in <code className="text-sm">src/styles/tokens.css</code>;
              components in <code className="text-sm">src/components/</code>.
            </p>
          </header>

          <Section
            id="voices"
            title="Three voices"
            intro="Researchers, participants and AI each have their own voice, so nobody mistakes a summary for a quote or a suggestion for a decision."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Researcher">
                <p>Capture unprompted reactions to each concept before any explanation. Public Sans on cool greys.</p>
              </Card>
              <Card title="Participant">
                <Quote source="P-07, 12:41 into the session">
                  Honestly the refill one made me trust it more. If they want me to keep the jar, they must think I’ll keep buying.
                </Quote>
              </Card>
              <AIContent label="Suggested probe">
                Ask what “premium” means to her in a moisturizer, before showing the price.
              </AIContent>
            </div>
          </Section>

          <Section id="colour" title="Colour" intro="Iris is kept for primary actions, focus and AI content. Statuses never use it.">
            <h3 className="mb-3 text-sm font-semibold">Iris</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch token="iris-50" note="AI wash" />
              <Swatch token="iris-100" />
              <Swatch token="iris-300" note="AI border" />
              <Swatch token="iris-500" />
              <Swatch token="iris-600" note="primary" />
              <Swatch token="iris-700" note="hover" />
              <Swatch token="iris-800" />
            </div>
            <h3 className="mt-8 mb-3 text-sm font-semibold">Neutrals</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Swatch token="ink" note="text" />
              <Swatch token="graphite" note="secondary" />
              <Swatch token="muted" note="tertiary" />
              <Swatch token="mist-strong" note="control border" />
              <Swatch token="mist" note="divider" />
              <Swatch token="haze" note="hover fill" />
              <Swatch token="paper" note="app background" />
              <Swatch token="surface" note="content" />
            </div>
            <h3 className="mt-8 mb-3 text-sm font-semibold">Status families</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {families.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-md border border-mist bg-surface p-3">
                  <span
                    className="flex size-10 items-center justify-center rounded-sm border"
                    style={{ background: `var(--color-${f}-bg)`, color: `var(--color-${f}-fg)`, borderColor: `var(--color-${f}-line)` }}
                  >
                    <StatusGlyph family={f} />
                  </span>
                  <div>
                    <div className="text-sm font-medium">{familyMeaning[f]}</div>
                    <div className="text-xs text-graphite">{f}-bg, {f}-fg, {f}-line</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="type" title="Type" intro="Public Sans for the interface with tabular figures throughout. Source Serif 4 only for participant verbatims.">
            <Card flush>
              <div className="px-5">
                {typeScale.map((t) => (
                  <TypeRow key={t.token} {...t} />
                ))}
                <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-6">
                  <div>
                    <div className="text-sm font-medium">text-quote, serif</div>
                    <div className="text-xs text-graphite">17px / 27px, verbatims only</div>
                  </div>
                  <p className="font-serif text-quote">“It feels like it’s doing something even after it sinks in.”</p>
                </div>
              </div>
            </Card>
          </Section>

          <Section id="space" title="Spacing, radii, shadows" intro="A 4px spacing base. Corners get rounder as surfaces get bigger. Only things that float get a shadow.">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Spacing">
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                    <div key={n} className="flex items-center gap-3 text-xs text-graphite tabular-nums">
                      <span className="w-20 whitespace-nowrap">{n} = {n * 4}px</span>
                      <span className="h-2.5 rounded-xs bg-iris-300" style={{ width: n * 4 }} />
                    </div>
                  ))}
                  <p className="mt-2 text-xs text-graphite">Layout: topbar 52px, stepper 264px, drawer 480px, content 1120px, mobile 375px.</p>
                </div>
              </Card>
              <Card title="Radii">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['xs', '4px, chips'],
                    ['sm', '6px, controls'],
                    ['md', '10px, surfaces'],
                    ['full', 'avatars, nodes'],
                  ].map(([r, label]) => (
                    <div key={r} className="flex flex-col items-start gap-2">
                      <span className="size-12 border-2 border-ink bg-haze" style={{ borderRadius: `var(--radius-${r})` }} />
                      <span className="text-xs text-graphite">
                        rounded-{r}
                        <br />
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Shadows">
                <div className="flex flex-col gap-5">
                  <div className="rounded-sm bg-surface p-3 text-sm shadow-raised ring-1 ring-mist">shadow-raised, selected items</div>
                  <div className="rounded-md bg-surface p-3 text-sm shadow-overlay">shadow-overlay, drawers and menus</div>
                </div>
              </Card>
            </div>
          </Section>

          <Section id="buttons" title="Buttons" intro="Labels say exactly what happens. One primary button per view.">
            <Card>
              <div className="flex flex-col gap-5">
                {(['md', 'sm'] as const).map((size) => (
                  <div key={size} className="flex flex-wrap items-center gap-3">
                    <span className="w-10 text-xs text-graphite">{size}</span>
                    <Button size={size} variant="primary">Approve version 3</Button>
                    <Button size={size} variant="secondary">Download PDF</Button>
                    <Button size={size} variant="ghost">Cancel</Button>
                    <Button size={size} variant="danger">Terminate study</Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-10 text-xs text-graphite">states</span>
                  <Button variant="primary" icon={<PlusIcon />}>Add question</Button>
                  <Button variant="primary" loading>Generating draft</Button>
                  <Button variant="primary" disabled>Authorize launch</Button>
                  <Button disabled>Share brief</Button>
                </div>
              </div>
            </Card>
          </Section>

          <Section id="status" title="Status chips" intro="Every vocabulary from CLAUDE.md. A name always keeps its family, whichever list it appears in.">
            <Card flush>
              <dl>
                {(Object.keys(vocabularies) as (keyof typeof vocabularies)[]).map((key) => (
                  <div key={key} className="grid gap-2 border-b border-mist px-5 py-3.5 last:border-b-0 sm:grid-cols-[200px_1fr] sm:gap-6">
                    <dt className="text-sm font-medium">{vocabularyLabels[key]}</dt>
                    <dd className="flex flex-wrap gap-2">
                      {vocabularies[key].map((s) => (
                        <StatusChip key={s} status={s} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
            <p className="mt-3 text-xs text-graphite">
              {Object.keys(statusFamily).length} status names across {Object.keys(vocabularies).length} vocabularies.
              Audience definition is a placeholder vocabulary, see docs/OPEN_QUESTIONS.md.
            </p>
          </Section>

          <Section
            id="ai"
            title="AI-generated content"
            intro="Anything the AI produced keeps the dashed iris border and tag until the Researcher accepts or edits it."
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <AIGeneratedTag />
                <span className="text-sm text-graphite">Inline tag, for table cells and short fields</span>
              </div>
              <AIContent
                label="Brand and category context, from web scan"
                actions={
                  <>
                    <Button size="sm" variant="ghost">Edit</Button>
                    <Button size="sm" variant="primary" icon={<CheckIcon />}>Accept</Button>
                  </>
                }
              >
                <p className="max-w-prose">
                  Verdane Skincare is a mid-priced US skincare brand sold through Target, Ulta and its own site. Refillable formats are
                  growing in prestige skincare but remain rare at mid-price points.
                </p>
              </AIContent>
            </div>
          </Section>

          <Section id="surfaces" title="Card, table, drawer">
            <Card
              flush
              title="Screening dashboard"
              description="Click a row to open the applicant drawer."
              actions={<Button size="sm">Export CSV</Button>}
            >
              <Table caption="Applicants" columns={applicantColumns} rows={demoApplicants} rowKey={(a) => a.id} onRowClick={setDrawer} />
            </Card>
            <SideDrawer
              open={Boolean(drawer)}
              onClose={() => setDrawer(null)}
              title={drawer?.name ?? ''}
              description={drawer ? `${drawer.id}, ${drawer.segment}` : undefined}
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDrawer(null)}>Close</Button>
                  <Button variant="primary">Mark Eligible</Button>
                </>
              }
            >
              {drawer && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <StatusChip status={drawer.screening} />
                    <StatusChip status={drawer.verification} />
                  </div>
                  <Quote source="Screener Q5, typed answer">I switch between CeraVe and whatever’s on sale at Target, honestly.</Quote>
                </div>
              )}
            </SideDrawer>
          </Section>

          <Section id="states" title="Empty, loading, error" intro="Empty states say what to do next. Errors say what went wrong and how to fix it.">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card flush>
                <EmptyState
                  title="No applicants yet"
                  description="Share the recruitment link or upload contacts to start screening."
                  action={<Button size="sm">Add participants</Button>}
                />
              </Card>
              <Card flush>
                <LoadingState label="Generating discussion guide" />
              </Card>
              <Card flush>
                <ErrorState
                  title="Upload failed"
                  description="concept-c.heic isn’t a supported format. Upload a JPG, PNG or MP4."
                  onRetry={() => undefined}
                  retryLabel="Upload again"
                />
              </Card>
            </div>
          </Section>

          <Section
            id="stepper"
            title="Stepper"
            intro="The study’s spine and the product’s one standout element. Solid thread where work is done, dashed where it’s still ahead or locked."
          >
            <div className="flex flex-wrap items-start gap-8">
              <div className="w-stepper rounded-md border border-mist bg-paper p-5">
                <Stepper steps={demoSteps} label="Example study steps" />
              </div>
              <div className="flex flex-col gap-3 text-sm text-graphite">
                <p className="flex items-center gap-2">
                  <ScreenTag id="R14" /> Screen IDs sit in a small outlined tag.
                </p>
                <p className="max-w-[40ch]">This example is the “Mid-way: guide in review” stage. Launch stays locked until the guide is Approved.</p>
              </div>
            </div>
          </Section>
        </main>
      </div>
    </div>
  )
}
