-- Keep manual parts owned by their root task. The previous SET NULL action
-- could promote deleted parts into visible root tasks.
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_parentTaskId_fkey";

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
