ALTER TABLE "User" ADD COLUMN "privo2ServiceId" STRING;
ALTER TABLE "User" ADD COLUMN "privo2GranterServiceId" STRING;
ALTER TABLE "User" ADD COLUMN "privo2ConsentId" STRING;
CREATE UNIQUE INDEX "User_privo2ServiceId_key" ON "User"("privo2ServiceId");
