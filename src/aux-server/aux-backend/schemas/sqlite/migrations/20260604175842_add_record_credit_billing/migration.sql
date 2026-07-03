-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Record" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "studioId" TEXT,
    "creditAccountId" TEXT,
    "creditBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "secretHashes" JSONB NOT NULL,
    "secretSalt" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Record_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "FinancialAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Record" ("createdAt", "name", "ownerId", "secretHashes", "secretSalt", "studioId", "updatedAt") SELECT "createdAt", "name", "ownerId", "secretHashes", "secretSalt", "studioId", "updatedAt" FROM "Record";
DROP TABLE "Record";
ALTER TABLE "new_Record" RENAME TO "Record";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
