## 1. Semantic Overview

A transaction entry is a natural-language text string that maps to a set of semantic transaction attributes. The entry consists of one mandatory monetary value, one mandatory description, and optional metadata fields (date, category, payment method).

## 2. Semantic Entities & Lexical Signatures

Every valid transaction record comprises the following semantic slots, each subject to a strict cardinality constraint (at most one occurrence per slot unless specified otherwise).

### 2.1 Amount (Mandatory, Exactly 1)

Represents the monetary value of the transaction.

Matches any valid monetary representation. Bare integers (e.g., `2`, `12`) are explicitly excluded and treated as free text.

* **Pattern**: `/^(R\$\s?)?\d+(\.\d{3})*,\d{2}$/i`
* **Example**: `R$ 1.200,00`, `R$1200,00`, `2,50`

### 2.2 Date (Optional, At Most 1)

Represents when the transaction occurred. Dates can be absolute, relative, or expressed in natural language (specifically Portuguese PT-BR semantics).

* **ISO Date**: `'yyyy'-'MM'-'dd'`
* **Short Date**: `'d'/'M'(/'yy'|'yyyy')?` — day first, then month; two-digit years are 20xx.
* **Abbreviated Natural Date**: `d MMM`
* **Weekday**: `('E..EEE'|'EEEE')` (with or without '-feira')
* **Joined Portuguese Month Form**: `'d' ('de')? ('MMM'|'MMMM')( ('de')? 'yyyy')?` — a four-digit run followed by a decimal separator and digits belongs to an amount, not to the year.
* **Explicit Relative Keywords**: Literal strings (`hoje`, `ontem`, `anteontem`, `amanhã`, `depois de amanhã`) 
* **Weekday Relative Expression**: Combines weekdays using either a preceding modifier or a succeeding modifier, but never both:
    * **Prefix Variant**: `(pr(o|ó)xima|(u|ú)ltima|es(s|t)a) ('E..EEE'|'EEEE')`
    * **Suffix Variant**: `('E..EEE'|'EEEE') (passada|retrasada|que vem)`

### 2.3 Category (Optional, At Most 1)

Represents a classification tag for the transaction.

Matches any word prefixed with a hash symbol, which must resolve against a known registry of Categories.

* **Pattern**: `/#[\w-]+/`
* *Example*: `#Food`, `#Transporte`

### 2.4 Payment Method (Optional, At Most 1)

Represents the instrument used to pay.

Matches any word prefixed with an at sign, which must resolve against a known registry of Payment Methods.

* **Pattern**: `/@[\w-]+/`
* *Example*: `@debit`, `@credit`

### 2.5 Description (Mandatory, Exactly 1)

Represents the free-form text narrative of the transaction (e.g., Almoço 2 pessoas).

* **Composition:** Formed by the contiguous body of free-form text tokens that are not captured by Amount, Date, Category, or Payment signatures.
* **Contiguity Principle:** The description must form a cohesive, unbroken semantic block. Disconnected fragments of free text separated by structured tokens cannot be merged into a single description. Once another semantic slot interrupts a description block, additional stray words are invalid.

## 3. Span Commitment

The parser reads **spans** — maximal contiguous character ranges — rather than words. A span matching a lexical signature (§2) is a **candidate** for that slot. Each candidate is either **committed** to its slot or **demoted** back into free text.

**Fixed candidates** — Amount, Category, Payment Method, and multi-word Date forms — commit unconditionally. If a commitment would violate a cardinality constraint (§2.1–§2.5), the entry is invalid.

**Provisional candidates** — bare weekdays and the standalone Date keywords (`hoje`, `ontem`, `anteontem`, `amanhã`) — commit by default, but are demoted when commitment would violate the Description requirement: the Description must exist and must be a single contiguous block of free text (§2.5). A demoted candidate is absorbed into the Description.

**Overlap.** Where candidates overlap, the longer span commits; the shorter is not a candidate.

| Input | Provisional candidate | Outcome |
|---|---|---|
| `desc seg 2,00` | `seg` | committed — Date = segunda, Description = desc |
| `desc seg moredesc 2,00` | `seg` | demoted — Description = "desc seg moredesc" |
| `hoje almoço 2,00` | `hoje` | committed — Date = hoje, Description = almoço |
| `almoço hoje bar 2,00` | `hoje` | demoted — Description = "almoço hoje bar" |
| `hoje 2,00` | `hoje` | demoted — Description = hoje |
## 4. Autocomplete Behavior

Suggestions are computed against the **active segment** — the characters following the last committed span. A provisional Date (§3) that has not yet committed remains inside the segment.

**Explicit prefixes.** A trailing word beginning with `#` suggests categories, each prefixed with `#`, if Category is unfilled. A trailing word beginning with `@` suggests payment methods, each prefixed with `@`, if Payment is unfilled. If the corresponding slot is already filled, no suggestions appear.

**Date-in-progress.** The segment is date-in-progress when its trailing characters begin a date form — a day number followed by ` de`, a space and a month prefix, or `/`, or a year followed by `-`, or a weekday or weekday modifier (§2.2) or a prefix of one — and remain a prefix of some date form of §2.2. A character that breaks the prefix relationship returns the segment to free-form.

In date-in-progress, suggestions are the date completions of §2.2 that extend the trailing date form.

| Segment | Mode |
|---|---|
| `12 de`, `12/`, `12 de junho de` | date-in-progress |
| `12 de xyz`, `12/ab` | free-form |
| `seg`, `próxima`, `próxima seg` | date-in-progress |
| `seg x` | free-form |

**Standalone keywords.** The standalone keywords of §2.2 are complete on their own and take no further date characters. Neither they nor their prefixes enter date-in-progress: a complete keyword is handed to §3 for commitment, an incomplete prefix stays free-form.

**Closed description.** If the Description has been closed by an earlier committed span and no Date has been committed, the segment is date-in-progress.

**Free-form text.** Otherwise, suggestions come from historical descriptions.