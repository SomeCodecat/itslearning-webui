/*
  Assignments and grades were previously shared between all users of a course,
  so their rows carry no owner and cannot be migrated. Both tables are a cache
  of ITSLearning state and repopulate on the next sync — clear them instead.
*/
DELETE FROM "Grade";
DELETE FROM "Assignment";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "elementId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "webUrl" TEXT,
    "deadline" DATETIME,
    "status" TEXT,
    CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("courseId", "deadline", "elementId", "id", "status", "title", "webUrl") SELECT "courseId", "deadline", "elementId", "id", "status", "title", "webUrl" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE UNIQUE INDEX "Assignment_elementId_userId_key" ON "Assignment"("elementId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
