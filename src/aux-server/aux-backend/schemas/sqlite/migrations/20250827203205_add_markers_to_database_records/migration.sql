/*
  Warnings:

  - Added the required column `markers` to the `DatabaseRecord` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DatabaseRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseProvider" TEXT NOT NULL,
    "tursoDatabaseId" TEXT NOT NULL,
    "tursoOrganization" TEXT NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "DatabaseRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DatabaseRecord" ("address", "createdAt", "databaseName", "databaseProvider", "recordName", "tursoDatabaseId", "tursoOrganization", "updatedAt") SELECT "address", "createdAt", "databaseName", "databaseProvider", "recordName", "tursoDatabaseId", "tursoOrganization", "updatedAt" FROM "DatabaseRecord";
DROP TABLE "DatabaseRecord";
ALTER TABLE "new_DatabaseRecord" RENAME TO "DatabaseRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
