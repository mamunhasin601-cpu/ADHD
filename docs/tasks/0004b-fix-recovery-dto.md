# Task 0004B: Require an Explicit Recovery Destination

**Status:** execute after 0004A  
**Scope:** recovery DTO and its focused tests  
**Next:** `0004c-fix-recovery-transaction.md`

## Command

Implement this exact contract now. Do not write an architecture plan, compare custom-validator
alternatives, read unrelated files, or ask for permission. The change is pre-approved.

## Source edit

In `apps/api/src/tasks/dto/reschedule-recovery.dto.ts`:

- remove `IsOptional` from the imports and from `targetStartTime`;
- add `IsDefined` and `ValidateIf` imports;
- apply these decorators in this order:

```ts
@ValidateIf((item: RescheduleItemDto) => item.targetStartTime !== null)
@IsDefined({
  message: 'targetStartTime must be explicitly provided as an ISO-8601 value or null',
})
@IsISO8601()
targetStartTime: string | null;
```

Required semantics:

- missing/`undefined`: rejected;
- explicit JSON `null`: accepted as Inbox;
- valid ISO-8601 string: accepted;
- empty or malformed string: rejected.

Do not add a custom validator unless a focused test proves the decorator pattern cannot provide
these semantics under the project's actual ValidationPipe.

## Tests

Create or update a focused DTO validation spec using `plainToInstance` and `validate`. Test all
four cases above and a valid UUID. Also prove an invalid UUID is rejected.

Run the focused spec, all API unit tests, and API build/typecheck. Fix in-scope failures instead
of only reporting them.

This task is incomplete unless the DTO and tests are actually changed. Stop after verification;
do not begin Task 0004C in this run.
