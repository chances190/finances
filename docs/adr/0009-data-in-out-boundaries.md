# 0009. Data In/Out Boundaries — Exchange vs Backup vs Ingest

- **Status:** Accepted
- **Date:** 2026-09-08

## Context
The app has three distinct data boundaries that serve different purposes: CSV exchange for spreadsheet/bank interchange, JSON backup for lossless round-trip, and CSV ingest for importing bank/card statements. These were previously tangled in a single `exportImport.ts` module.

## Decision
Split into three modules under `data/`:

- **`exchange/csv.ts`** — CSV export/import for human-readable interchange. Uses a `ref` scheme (sequential `r001`/`r002`) for cross-row referencing. Debt splits are 1NF (one debtor per row, same `ref`). Installments are head-anchored: the head row carries `installmentTotal`, children reference it via `installmentRef`. No internal IDs (`parentId`/`groupId`) leak into the format.

- **`backup/json.ts`** — JSON export/import for lossless backup/restore. Serializes the full `FinanceData` document via `JSON.stringify` and validates on import via `validateFinanceData()`. Preserves all domain fields including internal IDs, debt splits, and installment metadata.

- **Ingest seam** — Bank/card statement CSV import (e.g., `scripts/import-card-csv.ts`) is a one-off script, not a general parser. It maps external formats into the domain model without imposing a schema on external data. The `CSVImportDialog` UI provides validation feedback rather than a formal ingestion layer.

## Consequences
- **Positive:** Clear separation of concerns — each module has a single responsibility; the CSV exchange format is now 1NF and doesn't leak internal IDs; the JSON backup remains lossless; ingest scripts are disposable and don't constrain the domain model.
- **Negative/Risks:** CSV exchange cannot represent every document faithfully (by design — it's interchange, not backup); ingest scripts must be kept in sync with the schema manually.
