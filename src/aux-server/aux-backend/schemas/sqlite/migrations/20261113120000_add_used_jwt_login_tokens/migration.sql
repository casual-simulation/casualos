-- CreateTable
CREATE TABLE "UsedJwtLoginToken" (
    "tokenId" TEXT NOT NULL PRIMARY KEY,
    "expireTime" DECIMAL NOT NULL,
    "usedTime" DECIMAL NOT NULL
);

-- CreateIndex
CREATE INDEX "UsedJwtLoginToken_expireTime_idx" ON "UsedJwtLoginToken"("expireTime");

