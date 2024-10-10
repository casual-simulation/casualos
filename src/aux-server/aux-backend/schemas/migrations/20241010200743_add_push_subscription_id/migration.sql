/*
  Warnings:

  - Added the required column `pushSubscriptionId` to the `NotificationSubscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NotificationSubscription" ADD COLUMN     "pushSubscriptionId" UUID NOT NULL;
