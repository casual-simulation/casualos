/*
  Warnings:

  - A unique constraint covering the columns `[email,loginStudioId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phoneNumber,loginStudioId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."User_email_key";

-- DropIndex
DROP INDEX "public"."User_phoneNumber_key";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "loginStudioId" STRING;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_loginStudioId_key" ON "public"."User"("email", "loginStudioId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_loginStudioId_key" ON "public"."User"("phoneNumber", "loginStudioId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_loginStudioId_fkey1" FOREIGN KEY ("loginStudioId") REFERENCES "public"."Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
