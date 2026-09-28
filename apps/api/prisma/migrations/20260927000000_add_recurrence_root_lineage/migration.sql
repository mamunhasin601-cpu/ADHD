-- A technical recurrence series is replaced whenever "this and future" is
-- edited. Keep a separate stable identity for the complete logical family.
ALTER TABLE "tasks" ADD COLUMN "recurrenceRootId" TEXT;

CREATE INDEX "tasks_userId_recurrenceRootId_idx"
  ON "tasks"("userId", "recurrenceRootId");

-- Every existing template starts as its own root. The recursive pass below
-- reconnects split successors created by the pre-lineage implementation.
UPDATE "tasks"
SET "recurrenceRootId" = "id"
WHERE "isRecurring" = true AND "seriesId" IS NULL;

-- Before recurrenceRootId existed, a split ended the predecessor and created
-- the successor in the same transaction. Their local date boundaries are
-- contiguous and createdAt/recurrenceEndedAt are therefore near-identical.
-- Choose the nearest unambiguous predecessor per successor, then carry the
-- oldest root through chains of any length.
WITH RECURSIVE
candidate_edges AS (
  SELECT
    successor."id" AS child_id,
    predecessor."id" AS parent_id,
    ROW_NUMBER() OVER (
      PARTITION BY successor."id"
      ORDER BY ABS(EXTRACT(EPOCH FROM (successor."createdAt" - predecessor."recurrenceEndedAt"))), predecessor."id"
    ) AS candidate_rank
  FROM "tasks" AS successor
  JOIN "tasks" AS predecessor
    ON predecessor."userId" = successor."userId"
   AND predecessor."id" <> successor."id"
   AND predecessor."isRecurring" = true
   AND predecessor."seriesId" IS NULL
   AND predecessor."recurrenceEndedAt" IS NOT NULL
   AND predecessor."recurrenceGeneratedThrough" = ((successor."recurrenceDateKey"::date - 1)::text)
   AND predecessor."recurrenceTimezone" IS NOT DISTINCT FROM successor."recurrenceTimezone"
   AND ABS(EXTRACT(EPOCH FROM (successor."createdAt" - predecessor."recurrenceEndedAt"))) <= 300
  WHERE successor."isRecurring" = true
    AND successor."seriesId" IS NULL
    AND successor."recurrenceDateKey" IS NOT NULL
),
edges AS (
  SELECT child_id, parent_id
  FROM candidate_edges
  WHERE candidate_rank = 1
),
lineage AS (
  SELECT template."id" AS node_id, template."id" AS root_id, ARRAY[template."id"] AS path
  FROM "tasks" AS template
  WHERE template."isRecurring" = true
    AND template."seriesId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM edges WHERE edges.child_id = template."id")

  UNION ALL

  SELECT edges.child_id, lineage.root_id, lineage.path || edges.child_id
  FROM lineage
  JOIN edges ON edges.parent_id = lineage.node_id
  WHERE NOT edges.child_id = ANY(lineage.path)
)
UPDATE "tasks" AS template
SET "recurrenceRootId" = lineage.root_id
FROM lineage
WHERE template."id" = lineage.node_id;

-- Concrete occurrences inherit the root of their current technical segment.
UPDATE "tasks" AS occurrence
SET "recurrenceRootId" = template."recurrenceRootId"
FROM "tasks" AS template
WHERE occurrence."seriesId" = template."id";
