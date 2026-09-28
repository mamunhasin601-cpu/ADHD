-- Keep legacy conflicts readable, but prevent every new or edited root
-- timeline entry from introducing an overlap. Completed tasks still own time.
CREATE OR REPLACE FUNCTION prevent_task_time_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW."userId" IS NOT DISTINCT FROM OLD."userId"
    AND NEW."startTime" IS NOT DISTINCT FROM OLD."startTime"
    AND NEW."durationMinutes" IS NOT DISTINCT FROM OLD."durationMinutes"
    AND NEW."parentTaskId" IS NOT DISTINCT FROM OLD."parentTaskId"
    AND NEW."isRecurring" IS NOT DISTINCT FROM OLD."isRecurring"
  THEN
    RETURN NEW;
  END IF;

  IF NEW."startTime" IS NULL OR NEW."parentTaskId" IS NOT NULL OR NEW."isRecurring" = TRUE THEN
    RETURN NEW;
  END IF;

  -- The row may have been deleted or changed again before this deferred
  -- check runs. In that case its newest trigger event owns validation.
  IF NOT EXISTS (
    SELECT 1
    FROM tasks AS current
    WHERE current.id = NEW.id
      AND current."userId" = NEW."userId"
      AND current."startTime" IS NOT DISTINCT FROM NEW."startTime"
      AND current."durationMinutes" IS NOT DISTINCT FROM NEW."durationMinutes"
      AND current."parentTaskId" IS NOT DISTINCT FROM NEW."parentTaskId"
      AND current."isRecurring" IS NOT DISTINCT FROM NEW."isRecurring"
  ) THEN
    RETURN NEW;
  END IF;

  -- Serialize schedule writes per owner so concurrent requests cannot both
  -- pass the overlap check before either row becomes visible.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."userId", 0));

  IF EXISTS (
    SELECT 1
    FROM tasks AS existing
    WHERE existing."userId" = NEW."userId"
      AND existing.id <> NEW.id
      AND existing."parentTaskId" IS NULL
      AND existing."isRecurring" = FALSE
      AND existing."startTime" IS NOT NULL
      AND (
        existing."startTime" = NEW."startTime"
        OR (
          NEW."durationMinutes" IS NOT NULL
          AND existing."startTime" > NEW."startTime"
          AND existing."startTime" < NEW."startTime" + make_interval(mins => NEW."durationMinutes")
        )
        OR (
          existing."durationMinutes" IS NOT NULL
          AND NEW."startTime" > existing."startTime"
          AND NEW."startTime" < existing."startTime" + make_interval(mins => existing."durationMinutes")
        )
      )
  ) THEN
    RAISE EXCEPTION 'TASK_TIME_SLOT_OCCUPIED' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_time_overlap_guard ON tasks;
CREATE CONSTRAINT TRIGGER task_time_overlap_guard
AFTER INSERT OR UPDATE
ON tasks
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION prevent_task_time_overlap();
