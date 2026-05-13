/*
  Warnings:

  - Added the required column `shop` to the `FollowUp` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FollowUp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
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
INSERT INTO "new_FollowUp" ("attempts", "callHistory", "createdAt", "customer", "draftId", "email", "id", "lastOutcome", "nextFollowUp", "notes", "orderName", "phone", "status", "total", "updatedAt") SELECT "attempts", "callHistory", "createdAt", "customer", "draftId", "email", "id", "lastOutcome", "nextFollowUp", "notes", "orderName", "phone", "status", "total", "updatedAt" FROM "FollowUp";
DROP TABLE "FollowUp";
ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";
CREATE UNIQUE INDEX "FollowUp_shop_draftId_key" ON "FollowUp"("shop", "draftId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
