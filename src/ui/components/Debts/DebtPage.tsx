import { UserIcon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoneyInput } from '@/components/ui/money-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ACCOUNT_LABELS,
  buildSettlement,
  CASH_ACCOUNTS,
  localYMD,
  type Outstanding,
  outstanding,
} from '@/domain/ledger'
import { formatCurrency, parseCurrency } from '@/lib/currency'
import EmptyState from '@/ui/components/Common/EmptyState'
import { useFinance } from '@/ui/context'
import { useToast } from '@/ui/context/ToastContext'
import { useIsDesktop } from '@/ui/hooks/useIsDesktop'

const BADGE_GREEN = 'text-green-600 bg-green-50 '
const BADGE_AMBER = 'text-amber-600 bg-amber-50 '

type Relation = 'receivable' | 'payable'

function RelationList({
  title,
  description,
  relation,
  rows,
  emptyMessage,
  onSettle,
  isDesktop,
}: {
  title: string
  description: string
  relation: Relation
  rows: Outstanding[]
  emptyMessage: string
  onSettle: (row: Outstanding) => void
  isDesktop: boolean
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className={relation === 'receivable' ? BADGE_GREEN : BADGE_AMBER}>
          {formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}
        </Badge>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : isDesktop ? (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead className="text-right">
                  {relation === 'receivable' ? 'Owed to you' : 'You owe'}
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.counterparty}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1">
                      <UserIcon className="size-3" />
                      {row.counterparty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onSettle(row)}>
                      Settle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.counterparty}
              className="flex items-center justify-between gap-3 border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-medium">
                  <UserIcon className="size-3 shrink-0" />
                  <span className="truncate">{row.counterparty}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatCurrency(row.amount)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onSettle(row)}>
                Settle
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function SettleDialog({
  relation,
  row,
  open,
  onOpenChange,
}: {
  relation: Relation
  row: Outstanding | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [cash, setCash] = useState('')
  const [forgiven, setForgiven] = useState('')
  const [account, setAccount] = useState<'checking' | 'voucher' | 'cash'>('checking')
  const [date, setDate] = useState(localYMD())
  const [description, setDescription] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: open is intentional to reset on dialog open
  useEffect(() => {
    setCash('')
    setForgiven('')
    setAccount('checking')
    setDate(localYMD())
    setDescription(row ? `Settled with ${row.counterparty}` : '')
  }, [row, open])

  function handleSave() {
    if (!row) return
    const paid = parseCurrency(cash)
    const waived = parseCurrency(forgiven)

    const settlement =
      relation === 'receivable'
        ? buildSettlement(
            {
              id: crypto.randomUUID(),
              date,
              description,
              direction: 'receivable',
              counterparty: row.counterparty,
              received: paid,
              forgiven: waived,
              account,
            },
            state.movements,
          )
        : buildSettlement(
            {
              id: crypto.randomUUID(),
              date,
              description,
              direction: 'payable',
              counterparty: row.counterparty,
              paid,
              forgiven: waived,
              account,
            },
            state.movements,
          )

    if (!settlement.ok) {
      toast(settlement.reason, 'error')
      return
    }
    dispatch({ type: 'ADD_MOVEMENTS', payload: [settlement.value] })
    toast('Settlement recorded', 'success')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{relation === 'receivable' ? 'Receive payment' : 'Pay someone'}</DialogTitle>
          <DialogDescription>
            {row
              ? `${row.counterparty} · ${formatCurrency(row.amount)} outstanding`
              : 'Record a settlement.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="settle-cash" className="text-xs">
                {relation === 'receivable' ? 'Received (R$)' : 'Paid (R$)'}
              </Label>
              <MoneyInput id="settle-cash" value={cash} onValueChange={setCash} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settle-forgiven" className="text-xs">
                Forgiven (R$)
              </Label>
              <MoneyInput id="settle-forgiven" value={forgiven} onValueChange={setForgiven} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="settle-date" className="text-xs">
                Date
              </Label>
              <Input
                id="settle-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="settle-account" className="text-xs">
                Account
              </Label>
              <Select
                modal={false}
                value={account}
                onValueChange={(value) =>
                  setAccount((value as 'checking' | 'voucher' | 'cash') ?? 'checking')
                }
              >
                <SelectTrigger id="settle-account" className="w-full">
                  <SelectValue>{ACCOUNT_LABELS[account]}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {CASH_ACCOUNTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ACCOUNT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="settle-description" className="text-xs">
              Description
            </Label>
            <Input
              id="settle-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function DebtPage() {
  const { state } = useFinance()
  const isDesktop = useIsDesktop()
  const [, navigate] = useLocation()
  const [settle, setSettle] = useState<{ relation: Relation; row: Outstanding } | null>(null)

  const receivables = useMemo(() => outstanding(state.movements, 'receivable'), [state.movements])
  const payables = useMemo(() => outstanding(state.movements, 'payable'), [state.movements])

  const emptyAction = { label: 'Go to Transactions', onClick: () => navigate('/') }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Debts</h2>
        <p className="text-xs text-muted-foreground">
          Money people owe you, and money you owe. Settlements never change your spending pace.
        </p>
      </div>

      {receivables.length === 0 && payables.length === 0 ? (
        <EmptyState
          message="No debts outstanding. Split a purchase or pay with “Someone else” to start one."
          action={emptyAction}
        />
      ) : (
        <>
          <RelationList
            title="Owed to you"
            description="Purchases you covered for someone else."
            relation="receivable"
            rows={receivables}
            emptyMessage="Nobody owes you right now."
            onSettle={(row) => setSettle({ relation: 'receivable', row })}
            isDesktop={isDesktop}
          />
          <RelationList
            title="You owe"
            description="Purchases someone else covered for you."
            relation="payable"
            rows={payables}
            emptyMessage="You do not owe anyone right now."
            onSettle={(row) => setSettle({ relation: 'payable', row })}
            isDesktop={isDesktop}
          />
        </>
      )}

      <SettleDialog
        relation={settle?.relation ?? 'receivable'}
        row={settle?.row ?? null}
        open={settle !== null}
        onOpenChange={(open) => {
          if (!open) setSettle(null)
        }}
      />
    </div>
  )
}
