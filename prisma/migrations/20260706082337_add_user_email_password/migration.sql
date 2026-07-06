-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "passwordHash" TEXT,
    "itslearningUser" TEXT,
    "itslearningPwd" TEXT,
    "itslearningIv" TEXT,
    "itslearningUrl" TEXT,
    "itslearningAccessToken" TEXT,
    "itslearningTokenExpiresAt" DATETIME,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncedAt" DATETIME
);
INSERT INTO "new_User" ("createdAt", "firstName", "id", "itslearningAccessToken", "itslearningIv", "itslearningPwd", "itslearningTokenExpiresAt", "itslearningUrl", "itslearningUser", "lastName", "lastSyncedAt", "updatedAt") SELECT "createdAt", "firstName", "id", "itslearningAccessToken", "itslearningIv", "itslearningPwd", "itslearningTokenExpiresAt", "itslearningUrl", "itslearningUser", "lastName", "lastSyncedAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_itslearningUser_key" ON "User"("itslearningUser");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
