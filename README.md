# rpgf_calculator

RPGF Calculator, updated Dec 2023 for RPGF3.

## How to run

Prettier: `npx prettier --write .`

Install npm: `npm install`

```js
node calculatorLogic.js
```

## Signature Verification

[Source: Alchemy's docs](https://docs.alchemy.com/docs/how-to-verify-a-message-signature-on-ethereum)

## RPGF Logic

### Calculator Logic

```constants
QUORUM = 17
MIN_AMOUNT = 1500
TOTAL_AMOUNT = 30000000
```

1. For each project, calculate: number of votes and median amount of OP
2. Projects with votes less than (<17) the quorum are marked as ineligible.
3. Scale the total to 30M OP: determine scale factor -> scale_factor = total_amount / sum of median amounts
4. If any projects are below (<1500) minimum amount, cut them.
5. Rerun the scaling with the remaining projects, up to a max of 10 times.
6. Check that the final allocation table sums to the right amount of OP = 30M. If not, print out missing amount.

### Output Schema + Definition

**VerifySig**

- address: original field
- signature: original field
- signed_payload: original field
- verified_signature: `BOOLEAN`

**outputResultsFinal**

- Project ID: `address`, unique based on vote counts
- Votes Array: `ARRAY`, raw array of the consolidated votes
- Votes Count: `INTEGER`
- Median Amount: `NUMERIC`
- Is Eligible: `BOOLEAN`
- Is Cut: `BOOLEAN`
- Scaled Amount: `NUMERIC`, this should be 0 if "Is Eligible" == `FALSE` OR "Is Cut" == `TRUE`
