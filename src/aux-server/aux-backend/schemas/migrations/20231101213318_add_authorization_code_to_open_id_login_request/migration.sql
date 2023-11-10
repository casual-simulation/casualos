-- AlterTable
ALTER TABLE "OpenIDLoginRequest" ADD COLUMN     "authorizationCode" STRING;
ALTER TABLE "OpenIDLoginRequest" ADD COLUMN     "authorizationTime" TIMESTAMP(3);
