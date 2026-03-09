-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FollowUp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "draftId" TEXT NOT NULL,
    "orderName" TEXT,
    "email" TEXT,
    "customer" TEXT,
    "phone" TEXT,
    "total" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastOutcome" TEXT,
    "nextFollowUp" DATETIME,
    "notes" TEXT,
    "callHistory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FollowUp" ("createdAt", "customer", "draftId", "email", "id", "orderName", "status", "total") SELECT "createdAt", "customer", "draftId", "email", "id", "orderName", "status", "total" FROM "FollowUp";
DROP TABLE "FollowUp";
ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
