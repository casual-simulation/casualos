-- CreateTable
CREATE TABLE "public"."CustomDomain" (
    "id" UUID NOT NULL,
    "studioId" STRING NOT NULL,
    "domainName" STRING(256) NOT NULL,
    "verificationKey" STRING(256) NOT NULL,
    "verified" BOOL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomDomain_domainName_idx" ON "public"."CustomDomain"("domainName");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_domainName_verified_key" ON "public"."CustomDomain"("domainName", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_studioId_domainName_key" ON "public"."CustomDomain"("studioId", "domainName");

-- AddForeignKey
ALTER TABLE "public"."CustomDomain" ADD CONSTRAINT "CustomDomain_studioId_fkey1" FOREIGN KEY ("studioId") REFERENCES "public"."Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
