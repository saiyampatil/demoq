// Mock contact details for participants. Every participant has an email address and a country. Researchers see the email
// masked ("j•••@gmail.com") and the full address on hover. No phone numbers are shown in Fieldwork or Review.

const FIRST = ['maya', 'daniel', 'priya', 'jordan', 'elena', 'marcus', 'hannah', 'tomas', 'aisha', 'caleb', 'naomi', 'luis', 'grace', 'owen', 'sofia', 'kenji', 'rachel', 'andre', 'chloe', 'victor', 'dana', 'miles', 'tessa', 'ravi']
const LAST = ['alvarez', 'brooks', 'chen', 'dawson', 'ellis', 'fischer', 'grant', 'hughes', 'ibrahim', 'jensen', 'kapoor', 'lopez', 'mitchell', 'nguyen', 'okafor', 'patel', 'quinn', 'reyes', 'singh', 'turner', 'underwood', 'vega', 'walker', 'young']
const DOMAIN = ['gmail.com', 'gmail.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com', 'proton.me']

/** A stable mock address from a participant or applicant ID such as "P-2041" or "A-2041". */
export function participantEmail(id: string): string {
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0
  const first = FIRST[(n * 7) % FIRST.length]
  const last = LAST[(n * 11 + 3) % LAST.length]
  const local = n % 4 === 0 ? `${first}${last[0]}${n % 100}` : n % 3 === 0 ? `${first}_${last}` : `${first}.${last}`
  return `${local}@${DOMAIN[(n * 5) % DOMAIN.length]}`
}

/** "j•••@gmail.com": the first letter of the name and the domain. */
export const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  return domain ? `${local[0] ?? ''}•••@${domain}` : email
}

/** All of the prototype's participants are in the United States; a state outside it would say so here. */
export const countryOfRegion = (region: string | null) => (region ? 'United States' : 'Unknown')
