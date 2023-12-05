-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "oidAccessToken" STRING;
ALTER TABLE "AuthSession" ADD COLUMN     "oidExpiresAtMs" INT4;
ALTER TABLE "AuthSession" ADD COLUMN     "oidIdToken" STRING;
ALTER TABLE "AuthSession" ADD COLUMN     "oidProvider" STRING;
ALTER TABLE "AuthSession" ADD COLUMN     "oidRefreshToken" STRING;
ALTER TABLE "AuthSession" ADD COLUMN     "oidRequestId" UUID;
ALTER TABLE "AuthSession" ADD COLUMN     "oidScope" STRING;
ALTER TABLE "AuthSession" ADD COLUMN     "oidTokenType" STRING;

-- CreateTable
CREATE TABLE "OpenIDLoginRequest" (
    "requestId" UUID NOT NULL,
    "provider" STRING NOT NULL,
    "codeVerifier" STRING NOT NULL,
    "codeMethod" STRING NOT NULL,
    "authorizationUrl" STRING NOT NULL,
    "scope" STRING NOT NULL,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "expireTime" TIMESTAMP(3) NOT NULL,
    "completedTime" TIMESTAMP(3),
    "ipAddress" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenIDLoginRequest_pkey" PRIMARY KEY ("requestId")
);

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_oidRequestId_fkey1" FOREIGN KEY ("oidRequestId") REFERENCES "OpenIDLoginRequest"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;
