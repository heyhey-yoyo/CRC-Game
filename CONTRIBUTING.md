# Contributing

## Before opening a pull request

1. Create a branch from `main`.
2. Run `npm run release:check`.
3. Keep medical facts, mechanism evidence and game abstractions in separate fields.
4. Do not add real doses, patient-specific recommendations or deterministic claims unsupported by the cited evidence.
5. Do not add executable JavaScript through case or evidence data.

## Medical-content checklist

Every new mechanism or pathway must state:

- where the effect occurs;
- required preconditions;
- expected direction of effect;
- known failure conditions;
- toxicity or ecological trade-offs;
- evidence tier and CRC relevance;
- game abstraction;
- at least one traceable source and access date.

## Code changes

- Prefer small, testable changes.
- Keep simulation functions deterministic for a fixed seed.
- Add regression tests for changes to outcomes, storage migrations or content validation.
- Preserve keyboard completion paths and the A→B→C→D→E→F reading order on narrow screens.
