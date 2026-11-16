ALTER TABLE "User" ADD COLUMN "privo2ServiceId" TEXT;
ALTER TABLE "User" ADD COLUMN "privo2GranterServiceId" TEXT;
ALTER TABLE "User" ADD COLUMN "privo2ConsentId" TEXT;
CREATE UNIQUE INDEX "User_privo2ServiceId_key" ON "User"("privo2ServiceId");
