export * from './ledger'

export function yearRelation(year: string): 'past' | 'current' | 'future' {
  const currentYear = String(new Date().getFullYear())
  if (year < currentYear) return 'past'
  if (year > currentYear) return 'future'
  return 'current'
}

export function splitEvenlyAcrossParticipants(
  totalAmount: number,
  otherParticipantCount: number,
): number[] {
  const totalCents = Math.round(totalAmount * 100)
  const participantCount = otherParticipantCount + 1
  const baseCents = Math.floor(totalCents / participantCount)
  const remainderCents = totalCents % participantCount

  return Array.from(
    { length: otherParticipantCount },
    (_, index) => (baseCents + (index < remainderCents ? 1 : 0)) / 100,
  )
}
