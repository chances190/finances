import { describe, expect, test } from 'bun:test'
import { expenseAmount, fundingAccountOf, incomeAmount, movementTotal } from '../domain/ledger'
import { importOFX } from './exchange/ofx'

const HEADER = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:NONE
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
`

function stmt(type: string, date: string, amount: string, fitid: string, memo: string) {
  return `<STMTTRN>
<TRNTYPE>${type}</TRNTYPE>
<DTPOSTED>${date}</DTPOSTED>
<TRNAMT>${amount}</TRNAMT>
<FITID>${fitid}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`
}

const CARD = `${HEADER}<OFX>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
${stmt('DEBIT', '20260927000000[-3:BRT]', '-6.64', 'a1', 'Drogasil')}
${stmt('DEBIT', '20260926000000[-3:BRT]', '-56.13', 'a2', 'Opencode')}
${stmt('CREDIT', '20260907000000[-3:BRT]', '1318.49', 'a3', 'Pagamento recebido')}
${stmt('CREDIT', '20260908000000[-3:BRT]', '25.00', 'a4', 'Refund store')}
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`

const BANK = `${HEADER}<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
${stmt('DEBIT', '20261001000000[-3:BRT]', '-128.00', 'b1', 'Transferência enviada pelo Pix - Francisco Gabriel de Lima Brasil (Transferência enviada)')}
${stmt('CREDIT', '20261005000000[-3:BRT]', '440.21', 'b2', 'Resgate RDB')}
${stmt('DEBIT', '20261007000000[-3:BRT]', '-933.45', 'b3', 'Pagamento de fatura')}
${stmt('CREDIT', '20261019000000[-3:BRT]', '70.00', 'b4', 'Transferência recebida pelo Pix - BRENDA MORAIS DO NASCIMENTO - •••.75')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

describe('importOFX', () => {
  test('maps a credit card statement to card purchases and a card credit', () => {
    const { movements, skipped, source } = importOFX(CARD, [])

    expect(source).toBe('card')
    expect(movements).toHaveLength(3)
    expect(movements[0]).toMatchObject({
      date: '2026-09-27',
      kind: 'purchase',
      description: 'Drogasil',
    })
    expect(fundingAccountOf(movements[0])).toBe('card')
    expect(movementTotal(movements[0])).toBe(6.64)

    const credit = movements[2]
    expect(credit.kind).toBe('refund')
    expect(fundingAccountOf(credit)).toBe('card')
    expect(expenseAmount(credit)).toBe(-25)
    expect(movementTotal(credit)).toBe(25)

    expect(skipped).toHaveLength(1)
    expect(skipped[0].reason).toBe('card bill payment')
  })

  test('maps a bank statement to checking purchases and income', () => {
    const { movements, skipped, source } = importOFX(BANK, [])

    expect(source).toBe('bank')
    expect(movements).toHaveLength(2)

    const [sent, received] = movements
    expect(sent).toMatchObject({
      date: '2026-10-01',
      kind: 'purchase',
      description: 'Francisco Gabriel de Lima Brasil',
    })
    expect(fundingAccountOf(sent)).toBe('checking')
    expect(movementTotal(sent)).toBe(128)

    expect(received.kind).toBe('income')
    expect(incomeAmount(received)).toBe(70)
    expect(received.description).toBe('BRENDA MORAIS DO NASCIMENTO')

    expect(skipped.map((entry) => entry.reason)).toEqual([
      'investment transfer',
      'card bill payment',
    ])
  })

  test('skips movements already imported', () => {
    const first = importOFX(BANK, [])
    const second = importOFX(BANK, first.movements)

    expect(second.movements).toHaveLength(0)
    expect(second.skipped.filter((entry) => entry.reason === 'already imported')).toHaveLength(2)
  })

  test('keeps distinct transactions that share a FITID', () => {
    const shared = `${HEADER}<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
${stmt('DEBIT', '20260926000000[-3:BRT]', '-1.96', 'same', 'IOF de "Opencode"')}
${stmt('DEBIT', '20260926000000[-3:BRT]', '-56.13', 'same', 'Opencode')}
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

    expect(importOFX(shared, []).movements).toHaveLength(2)
  })
})
