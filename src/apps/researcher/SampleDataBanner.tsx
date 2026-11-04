import { Banner } from '@/components/Banner'
import { Button } from '@/components/Button'
import { MOISTURIZER_ID } from '@/mock/moisturizerStudy'
import { screenById, studyPath } from '@/routes/screens'
import { useStudies } from '@/state/StudyContext'

/** Shown on every Fieldwork and Review screen while the study hasn't launched, so they all read the same way. */
export function SampleDataBanner({ studyId }: { studyId: string }) {
  const { setStage } = useStudies()
  return (
    <Banner
      tone="info"
      title="Sample data: this study hasn’t launched"
      actions={
        <>
          <Button size="sm" to={studyPath(studyId, screenById.R15)}>
            Go to launch
          </Button>
          {import.meta.env.DEV && studyId === MOISTURIZER_ID && (
            <Button size="sm" variant="ghost" onClick={() => setStage('live')}>
              Dev: load the Live stage
            </Button>
          )}
        </>
      }
    >
      These are example sessions so you can see how fieldwork and review work. Nothing here can be changed. Real sessions appear once the study is Live.
    </Banner>
  )
}
