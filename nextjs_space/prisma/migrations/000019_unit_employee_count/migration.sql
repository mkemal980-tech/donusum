ALTER TABLE "Unit" ADD COLUMN "employeeCount" INTEGER;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_employeeCount_nonnegative" CHECK ("employeeCount" >= 0);
