import { Tooltip } from '@/components/Tooltip'
import { maskEmail } from '@/mock/participants'

/** The address masked, with the full address on hover or keyboard focus. */
export function MaskedEmail({ email }: { email: string }) {
  return (
    <Tooltip content={email} focusable align="left">
      <span className="whitespace-nowrap tabular-nums" data-testid="masked-email">
        {maskEmail(email)}
      </span>
    </Tooltip>
  )
}
