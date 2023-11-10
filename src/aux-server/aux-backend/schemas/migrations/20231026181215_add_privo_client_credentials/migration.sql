-- AlterTable
ALTER TABLE "LoginRequest" ALTER COLUMN "secretHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PrivoClientCredentials" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "accessToken" STRING NOT NULL,
    "refreshToken" STRING NOT NULL,
    "expiresAtSeconds" INT4 NOT NULL,
    "scope" STRING NOT NULL,

    CONSTRAINT "PrivoClientCredentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivoClientCredentials_expiresAt_idx" ON "PrivoClientCredentials"("expiresAt");
