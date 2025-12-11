-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "verificationKey" TEXT NOT NULL,
    "verified" BOOLEAN,
    "createdAt" DECIMAL NOT NULL,
    "updatedAt" DECIMAL NOT NULL,
    CONSTRAINT "CustomDomain_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CustomDomain_domainName_idx" ON "CustomDomain"("domainName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_domainName_verified_key" ON "CustomDomain"("domainName", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_studioId_domainName_key" ON "CustomDomain"("studioId", "domainName");
