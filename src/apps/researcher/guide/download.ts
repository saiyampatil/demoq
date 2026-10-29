import { textToPdf } from '@/lib/pdf'
import { guideAsText, type GuideDoc } from '@/state/guide'

/** Saves the guide as a PDF. Downloading never changes the guide's status. */
export function downloadGuide(doc: GuideDoc, studyName: string) {
  const url = URL.createObjectURL(textToPdf(guideAsText(doc, studyName).split('\n')))
  const a = document.createElement('a')
  a.href = url
  a.download = `${studyName.replace(/\s+/g, '-').toLowerCase()}-guide-v${doc.version}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
