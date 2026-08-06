# 0005. Import/Export via Conventional Formats (JSON + CSV)

- **Status:** Accepted
- **Date:** 2026-08-06

## Context
A local-only app (ADR-0002) needs backup and data movement between machines, and the user tracks bank/card statements externally. A proprietary or binary format would trap the data and block statement ingestion.

## Decision
Export/import through conventional, human-readable formats in `data/exportImport.ts`: JSON (the full `FinanceData` document, validated on import) for lossless backup/restore, and CSV (transactions with debt splits and installments flattened via `/`-joined columns) for spreadsheet/bank interchange. A one-off script (`scripts/import-card-csv.ts`) maps card-statement rows (PT-BR categories, `DD/MM/YYYY` dates, `R$` amounts) into the domain model.

## Consequences
- **Positive:** Data is never trapped — JSON round-trips the whole document; CSV enables statement ingestion and spreadsheet editing; both formats are debuggable by eye.
- **Negative/Risks:** CSV flattens nested structures (debt splits, installments), so it cannot represent every document faithfully — it is interchange, not backup; the JSON/CSV import paths and the migration script must be kept in sync with the schema.
