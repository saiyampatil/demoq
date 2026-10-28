const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatDate = (iso: string) => date.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
