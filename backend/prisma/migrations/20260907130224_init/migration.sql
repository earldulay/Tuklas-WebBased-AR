-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'teacher');

-- CreateEnum
CREATE TYPE "ViewMode" AS ENUM ('ar', 'fallback');

-- CreateEnum
CREATE TYPE "ActivityStage" AS ENUM ('Predict', 'Observe', 'Explain', 'Reflection');

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "choices" TEXT[],
    "observe" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRecord" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "moduleId" TEXT NOT NULL,
    "mode" "ViewMode" NOT NULL,
    "stage" "ActivityStage" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityRecord_moduleId_idx" ON "ActivityRecord"("moduleId");

-- CreateIndex
CREATE INDEX "ActivityRecord_role_idx" ON "ActivityRecord"("role");

-- CreateIndex
CREATE INDEX "ActivityRecord_createdAt_idx" ON "ActivityRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "ActivityRecord" ADD CONSTRAINT "ActivityRecord_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
