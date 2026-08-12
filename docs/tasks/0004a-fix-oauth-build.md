# Task 0004A: Fix the Two OAuth Build Errors

**Status:** execute now  
**Scope:** exactly two source files  
**Next:** `0004b-fix-recovery-dto.md`

## Command

Make the edits now. Do not write a plan, explain alternatives, read unrelated files, or ask for
permission. These two changes are pre-approved.

You may modify the two files below. Preserve every unrelated line and existing user change.

## Edit 1

In `apps/api/src/auth/auth.service.ts`, change:

```ts
private generateTokens(user: User): AuthTokens {
```

to:

```ts
generateTokens(user: User): AuthTokens {
```

Do not change token behavior.

## Edit 2

In `apps/api/src/auth/oauth.service.ts`, replace the `OR` construction that contains conditional
`undefined` entries and `.filter(Boolean)` with a typed array containing only present values.

Use this behavior-preserving shape immediately before `findFirst`:

```ts
const identityConditions: Array<{ email: string } | { phone: string }> = [];
if (profile.email) identityConditions.push({ email: profile.email });
if (profile.phone) identityConditions.push({ phone: profile.phone });

user = await this.prisma.user.findFirst({
  where: { OR: identityConditions },
});
```

The surrounding `if (profile.email || profile.phone)` already guarantees the array is not empty.

## Verify

Run API build/typecheck and the existing auth/API unit tests. If one of these exact edits causes
a failure, fix it in the same two-file scope. Report the changed lines and command results.

This task is incomplete unless both files are actually modified. Stop after verification; do
not begin Task 0004B in this run.
