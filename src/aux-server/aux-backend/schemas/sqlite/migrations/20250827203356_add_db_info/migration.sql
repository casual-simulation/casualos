/*
  Warnings:

  - You are about to drop the column `tursoDatabaseId` on the `DatabaseRecord` table. All the data in the column will be lost.
  - You are about to drop the column `tursoOrganization` on the `DatabaseRecord` table. All the data in the column will be lost.
  - Added the required column `databaseInfo` to the `DatabaseRecord` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DatabaseRecord" (
    "recordName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseProvider" TEXT NOT NULL,
    "databaseInfo" JSONB NOT NULL,
    "markers" JSONB NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,

    PRIMARY KEY ("recordName", "address"),
    CONSTRAINT "DatabaseRecord_recordName_fkey" FOREIGN KEY ("recordName") REFERENCES "Record" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DatabaseRecord" ("address", "createdAt", "databaseName", "databaseProvider", "markers", "recordName", "updatedAt") SELECT "address", "createdAt", "databaseName", "databaseProvider", "markers", "recordName", "updatedAt" FROM "DatabaseRecord";
DROP TABLE "DatabaseRecord";
ALTER TABLE "new_DatabaseRecord" RENAME TO "DatabaseRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
