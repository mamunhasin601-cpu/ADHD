CREATE TABLE "task_create_requests" (
  "userId" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "taskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "task_create_requests_pkey" PRIMARY KEY ("userId", "requestId")
);

CREATE UNIQUE INDEX "task_create_requests_taskId_key"
  ON "task_create_requests"("taskId");

ALTER TABLE "task_create_requests"
  ADD CONSTRAINT "task_create_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_create_requests"
  ADD CONSTRAINT "task_create_requests_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
