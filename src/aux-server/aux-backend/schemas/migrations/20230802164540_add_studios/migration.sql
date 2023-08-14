-- DropForeignKey
ALTER TABLE "Record" DROP CONSTRAINT "Record_ownerId_fkey";

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "studioId" STRING;
ALTER TABLE "Record" ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Studio" (
    "id" STRING NOT NULL,
    "displayName" STRING NOT NULL,
    "subscriptionStatus" STRING,
    "stripeCustomerId" STRING,
    "subscriptionId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioAssignment" (
    "studioId" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "isPrimaryContact" BOOL NOT NULL,
    "role" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioAssignment_pkey" PRIMARY KEY ("studioId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeCustomerId_key" ON "Studio"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "StudioAssignment" ADD CONSTRAINT "StudioAssignment_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioAssignment" ADD CONSTRAINT "StudioAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
