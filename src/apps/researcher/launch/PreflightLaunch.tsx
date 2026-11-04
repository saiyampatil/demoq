import { Navigate, useParams } from 'react-router'
import { screenById, studyPath } from '@/routes/screens'

/** Launch is one screen now. The old preflight and authorize address lands there. */
export function PreflightLaunch() {
  const { studyId = '' } = useParams()
  return <Navigate to={studyPath(studyId, screenById.R15)} replace />
}
