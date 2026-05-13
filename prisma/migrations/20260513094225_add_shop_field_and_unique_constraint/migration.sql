-- Safe migration for existing SQLite FollowUp table
-- Adds shop column with default value and preserves old data

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_FollowUp" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "shop" TEXT NOT NULL DEFAULT 'floorcity.myshopify.com',
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

INSERT INTO "new_FollowUp" (
  "id",
  "shop",
  "draftId",
  "orderName",
  "email",
  "customer",
  "phone",
  "total",
  "attempts",
  "lastOutcome",
  "nextFollowUp",
  "notes",
  "callHistory",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  'floorcity.myshopify.com',
  "draftId",
  "orderName",
  "email",
  "customer",
  "phone",
  "total",
  COALESCE("attempts", 0),
  "lastOutcome",
  "nextFollowUp",
  "notes",
  "callHistory",
  COALESCE("status", 'new'),
  COALESCE("createdAt", CURRENT_TIMESTAMP),
  COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "FollowUp";

DROP TABLE "FollowUp";

ALTER TABLE "new_FollowUp" RENAME TO "FollowUp";

CREATE UNIQUE INDEX "FollowUp_shop_draftId_key" ON "FollowUp"("shop", "draftId");

PRAGMA foreign_keys=ON;