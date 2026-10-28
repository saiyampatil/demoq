import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { EmailListField } from '@/components/EmailListField'
import { TextArea } from '@/components/Field'
import { PrinterIcon } from '@/components/icons'
import { Tooltip } from '@/components/Tooltip'

type Method = 'email' | 'download'

type SendForApprovalCardProps = {
  version: number
  /** Why sending is blocked, if it is. Both methods share the same blockers. */
  blockers: string[]
  onSendEmail: (emails: string[], message: string) => void
  onDownload: () => void
}

export function SendForApprovalCard({ version, blockers, onSendEmail, onDownload }: SendForApprovalCardProps) {
  const [method, setMethod] = useState<Method>('email')
  const [emails, setEmails] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const blocked = blockers.length > 0

  const options: { value: Method; label: string; hint: string }[] = [
    { value: 'email', label: 'Email the client', hint: 'The client gets a link to approve, decline or comment. Their answer is recorded for you.' },
    { value: 'download', label: 'Download PDF', hint: 'You send the PDF yourself, then record the client’s decision here.' },
  ]

  const submitEmail = (
    <Button type="submit" variant="primary" disabled={blocked}>
      Send for approval
    </Button>
  )

  return (
    <Card title="Send for approval" description={`Choose how version ${version} reaches the client.`}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">How to send the brief</legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={cn('flex cursor-pointer gap-2.5 rounded-sm border px-3 py-2.5', method === o.value ? 'border-ink bg-paper' : 'border-mist hover:border-mist-strong')}
            >
              <input
                type="radio"
                name="method"
                value={o.value}
                className="mt-1 accent-[var(--color-iris-600)]"
                checked={method === o.value}
                onChange={() => setMethod(o.value)}
              />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-graphite">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {method === 'email' ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitted(true)
              if (blocked || emails.length === 0) return
              onSendEmail(emails, message)
            }}
          >
            <EmailListField
              label="Client email addresses"
              value={emails}
              onChange={setEmails}
              placeholder="name@company.com"
              hint="Press Enter or comma after each address. Add everyone who can approve."
              error={submitted && emails.length === 0 ? 'Add at least one email address.' : undefined}
            />
            <TextArea label="Message (optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note for the client" />
            <p className="text-xs text-graphite">
              Each person gets a link to a read-only preview. The first approval or decline closes the request. Comments don’t change the status.
            </p>
            {blocked ? (
              <Tooltip focusable align="left" content={`You can’t send yet: ${blockers.join('. ')}.`}>
                {submitEmail}
              </Tooltip>
            ) : (
              submitEmail
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-graphite">Downloading marks version {version} as In Review. Then record what the client decided below.</p>
            {blocked ? (
              <Tooltip focusable align="left" content={`You can’t send yet: ${blockers.join('. ')}.`}>
                <Button variant="primary" icon={<PrinterIcon />} disabled>
                  Download PDF
                </Button>
              </Tooltip>
            ) : (
              <Button variant="primary" icon={<PrinterIcon />} onClick={onDownload} className="self-start">
                Download PDF
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
