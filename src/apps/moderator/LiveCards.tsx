import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/Toast'
import { LIVE_OFFER_SECONDS, liveOfferAnswered, liveOfferExpired } from '@/state/fieldwork'
import { liveOffersFor, type LiveOffer } from '@/state/requests'
import { HandoffDrawer } from './Handoff'
import type { useModeratorData } from './Sessions'

type Data = ReturnType<typeof useModeratorData>

/**
 * A participant asked for a person and the AI is waiting. The card is pinned above every tab, offered to every online
 * standby moderator at once with one countdown. The first to accept takes it and the card goes from the others; if the
 * time runs out with nobody accepting, the AI asks the participant for a time instead.
 */
export function LiveCards({ data }: { data: Data }) {
  const { me, all, act, studyName, language } = data
  const toast = useToast()
  const offers = liveOffersFor(all, me.id, studyName, language)
  const [tick, setTick] = useState(0)
  const [taken, setTaken] = useState<{ studyId: string; sessionId: string }>()
  const expired = useRef(new Set<string>())

  // One timer for everyone: it counts from when the offer began, not from when this moderator opened the page.
  useEffect(() => {
    if (offers.length === 0) return
    const id = window.setInterval(() => setTick((t) => t + 1), 500)
    return () => window.clearInterval(id)
  }, [offers.length])
  const left = (o: LiveOffer) => Math.max(0, Math.ceil(LIVE_OFFER_SECONDS - (Date.now() - o.startedAtMs) / 1000))
  useEffect(() => {
    offers.forEach((o) => {
      if (left(o) === 0 && !expired.current.has(o.key)) {
        expired.current.add(o.key)
        act(o.studyId, (d) => liveOfferExpired(d, o.session.id))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, offers.length])

  const session = taken ? all[taken.studyId]?.sessions.find((s) => s.id === taken.sessionId) : undefined
  const doc = taken ? all[taken.studyId] : undefined

  return (
    <>
      {offers.length > 0 && (
        <div className="flex flex-col gap-3" role="region" aria-label="Live escalation" data-testid="live-cards">
          {offers.map((o) => (
            <section key={o.key} data-testid="live-card" data-participant={o.session.participantId} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border-2 border-iris-600 bg-iris-50 px-5 py-4">
              <div className="min-w-56 flex-1">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-iris-700 uppercase">
                  <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-iris-600" />
                  Live: asking to speak with a person
                </p>
                <p className="mt-1 text-md font-semibold">
                  {o.name} <span className="text-sm font-normal text-graphite tabular-nums">{o.session.participantId}</span>
                </p>
                <p className="text-sm text-graphite">
                  {o.language} · {o.studyName}
                </p>
                <p className="mt-0.5 text-sm text-graphite">AI covered: {o.covered.length ? o.covered.map((c) => `${c.title} (${c.done} of ${c.of})`).join(', ') : 'nothing yet'}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm tabular-nums" data-testid="live-countdown" aria-live="off">
                  <span className="text-2xl font-semibold">{left(o)}</span> <span className="text-graphite">s left. Offered to every online standby moderator.</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    data-testid="live-accept"
                    onClick={() => {
                      act(o.studyId, (d) => liveOfferAnswered(d, o.session.id, me.id, 'Accepted'))
                      setTaken({ studyId: o.studyId, sessionId: o.session.id })
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    data-testid="live-decline"
                    onClick={() => {
                      act(o.studyId, (d) => liveOfferAnswered(d, o.session.id, me.id, 'Declined'))
                      toast('Declined. The others can still accept.')
                    }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
      {taken && session && doc && (
        <HandoffDrawer open onClose={() => setTaken(undefined)} title={`${data.me.name}, you have ${session.participantId}`} subtitle={`${studyName(taken.studyId)} · ${language(taken.studyId) ?? 'English (US)'}`} doc={doc} session={session}>
          <p className="rounded-sm bg-iris-50 px-3 py-2 text-sm" data-testid="handoff-note">
            You accepted first. The participant is waiting. Pick up after the last question the AI asked; nothing below needs repeating.
          </p>
        </HandoffDrawer>
      )}
    </>
  )
}
