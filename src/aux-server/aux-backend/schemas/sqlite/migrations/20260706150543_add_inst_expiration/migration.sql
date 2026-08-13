-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstRecord" (
    "recordName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "expires" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "name"),
    CONSTRAINT "InstRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InstRecord" ("createdAt", "markers", "name", "recordName", "updatedAt") SELECT "createdAt", "markers", "name", "recordName", "updatedAt" FROM "InstRecord";
DROP TABLE "InstRecord";
ALTER TABLE "new_InstRecord" RENAME TO "InstRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
