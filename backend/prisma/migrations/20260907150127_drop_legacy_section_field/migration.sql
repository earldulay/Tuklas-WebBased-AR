-- The free-text `section` column on User is superseded by the Section
-- model + sectionId relation added in add_sections. Its one existing
-- value was already migrated into a real Section row before this ran.
-- AlterTable
ALTER TABLE "User" DROP COLUMN "section";
