-- AlterTable
ALTER TABLE "AuthSession" ADD COLUMN     "webauthnRequestId" UUID;

-- CreateTable
CREATE TABLE "UserAuthenticator" (
    "id" UUID NOT NULL,
    "userId" STRING NOT NULL,
    "credentialId" STRING(512) NOT NULL,
    "credentialPublicKey" BYTES NOT NULL,
    "counter" INT4 NOT NULL,
    "credentialDeviceType" STRING(32) NOT NULL,
    "credentialBackedUp" BOOL NOT NULL,
    "transports" STRING[],

    CONSTRAINT "UserAuthenticator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnLoginRequest" (
    "requestId" UUID NOT NULL,
    "challenge" STRING NOT NULL,
    "userId" STRING,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "expireTime" TIMESTAMP(3) NOT NULL,
    "completedTime" TIMESTAMP(3),
    "ipAddress" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAuthnLoginRequest_pkey" PRIMARY KEY ("requestId")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthenticator_credentialId_key" ON "UserAuthenticator"("credentialId");

-- AddForeignKey
ALTER TABLE "UserAuthenticator" ADD CONSTRAINT "UserAuthenticator_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_webauthnRequestId_fkey1" FOREIGN KEY ("webauthnRequestId") REFERENCES "WebAuthnLoginRequest"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnLoginRequest" ADD CONSTRAINT "WebAuthnLoginRequest_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
