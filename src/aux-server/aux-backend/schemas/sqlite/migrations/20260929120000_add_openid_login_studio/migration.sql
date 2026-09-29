-- AlterTable
ALTER TABLE "OpenIDLoginRequest" ADD COLUMN "loginStudioId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OpenIdIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "loginStudioId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DECIMAL NOT NULL,
    CONSTRAINT "OpenIdIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OpenIdIdentity" ("id", "createdAt", "provider", "subject", "userId") SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), "createdAt", "provider", "subject", "userId" FROM "OpenIdIdentity";
DROP TABLE "OpenIdIdentity";
ALTER TABLE "new_OpenIdIdentity" RENAME TO "OpenIdIdentity";
CREATE INDEX "OpenIdIdentity_userId_idx" ON "OpenIdIdentity"("userId");
CREATE UNIQUE INDEX "OpenIdIdentity_provider_subject_loginStudioId_key" ON "OpenIdIdentity"("provider", "subject", "loginStudioId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

