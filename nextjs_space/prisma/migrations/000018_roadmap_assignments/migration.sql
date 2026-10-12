ALTER TABLE "RoadmapItem"
  ADD COLUMN "assigneeId" TEXT,
  ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "RoadmapItem_assigneeId_dueDate_idx" ON "RoadmapItem"("assigneeId", "dueDate");

ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
