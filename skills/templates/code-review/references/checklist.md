# Review Checklist by PR Type

## New Feature

- [ ] Acceptance criteria met
- [ ] Tests cover happy path + edge cases
- [ ] API documentation updated
- [ ] No breaking changes to existing contracts
- [ ] Loading/error/empty states handled in UI
- [ ] Feature flag if needed for gradual rollout

## Bug Fix

- [ ] Root cause identified and documented
- [ ] Fix addresses root cause (not symptom)
- [ ] Regression test added
- [ ] No unrelated changes mixed in
- [ ] Verified fix in environment where bug was reported

## Refactoring

- [ ] Behavior preserved (no functional changes)
- [ ] Existing tests still pass
- [ ] No dead code left behind
- [ ] Import paths updated everywhere
- [ ] No performance regression

## Database Migration

- [ ] Reversible migration (up + down)
- [ ] No data loss for existing records
- [ ] Default values for new columns
- [ ] Indexes for new query patterns
- [ ] Migration tested on copy of production data
