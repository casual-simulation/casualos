-- CreateTable
CREATE TABLE "public"."UsedJwtLoginToken" (
    "tokenId" STRING(64) NOT NULL,
    "expireTime" TIMESTAMP(3) NOT NULL,
    "usedTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedJwtLoginToken_pkey" PRIMARY KEY ("tokenId")
);

-- CreateIndex
CREATE INDEX "UsedJwtLoginToken_expireTime_idx" ON "public"."UsedJwtLoginToken"("expireTime");

