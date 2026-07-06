-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itslearningId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "friendlyName" TEXT,
    "color" TEXT,
    "fillColor" TEXT,
    "taskCount" INTEGER,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "lastVisitedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("code", "id", "itslearningId", "title", "updatedAt") SELECT "code", "id", "itslearningId", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
CREATE UNIQUE INDEX "Course_itslearningId_key" ON "Course"("itslearningId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
