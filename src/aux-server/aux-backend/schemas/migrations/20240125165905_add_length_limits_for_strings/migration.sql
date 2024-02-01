/*
  Warnings:

  - The `description` column on the `FileRecord` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `logoUrl` column on the `Studio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `name` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `email` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `phoneNumber` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `banReason` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `recordName` column on the `UserInstReport` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `name` on the `Record` table. The data in that column will be cast from `String` to `String`. This cast may fail. Please make sure the data in the column can be cast.
  - Changed the type of `recordName` on the `BranchUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `instName` on the `BranchUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `branchName` on the `BranchUpdate` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `DataRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `address` on the `DataRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `EventRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `name` on the `EventRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `FileRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `fileName` on the `FileRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `InstBranch` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `instName` on the `InstBranch` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `name` on the `InstBranch` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `InstRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `name` on the `InstRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `ManualDataRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `address` on the `ManualDataRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `Policy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `marker` on the `Policy` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `RecordKey` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `name` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `recordName` on the `RoleAssignment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `roleId` on the `RoleAssignment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `displayName` on the `Studio` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `inst` on the `UserInstReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reportReasonText` on the `UserInstReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reportReason` on the `UserInstReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reportedUrl` on the `UserInstReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reportedPermalink` on the `UserInstReport` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

-- AlterTable
ALTER TABLE "BranchUpdate" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "BranchUpdate" ALTER "instName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "BranchUpdate" ALTER "branchName" TYPE STRING(512); --USING NOT NULL;

-- AlterTable
ALTER TABLE "DataRecord" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "DataRecord" ALTER "address" TYPE STRING(512); --USING NOT NULL;

-- AlterTable
ALTER TABLE "EventRecord" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "EventRecord" ALTER "name" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "FileRecord" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "FileRecord" ALTER "fileName" TYPE STRING(512); --USING NOT NULL;
ALTER TABLE "FileRecord" ALTER "description" TYPE STRING(128);

-- AlterTable
ALTER TABLE "InstBranch" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "InstBranch" ALTER "instName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "InstBranch" ALTER "name" TYPE STRING(512); --USING NOT NULL;

-- AlterTable
ALTER TABLE "InstRecord" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "InstRecord" ALTER "name" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "ManualDataRecord" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "ManualDataRecord" ALTER "address" TYPE STRING(512); --USING NOT NULL;

-- AlterTable
ALTER TABLE "Policy" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "Policy" ALTER "marker" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "RecordKey" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "Role" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "Role" ALTER "name" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "RoleAssignment" ALTER "recordName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "RoleAssignment" ALTER "roleId" TYPE STRING(128); --USING NOT NULL;

-- AlterTable
ALTER TABLE "Studio" ALTER "displayName" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "Studio" ALTER "logoUrl" TYPE STRING(512);

-- AlterTable
ALTER TABLE "User" ALTER "name" TYPE STRING(128);
ALTER TABLE "User" ALTER "email" TYPE STRING(128);
ALTER TABLE "User" ALTER "phoneNumber" TYPE STRING(64);
ALTER TABLE "User" ALTER "banReason" TYPE STRING(128);

-- AlterTable
ALTER TABLE "UserInstReport" ALTER "recordName" TYPE STRING(128);
ALTER TABLE "UserInstReport" ALTER "inst" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "UserInstReport" ALTER "reportReasonText" TYPE STRING(2048); --USING NOT NULL;
ALTER TABLE "UserInstReport" ALTER "reportReason" TYPE STRING(128); --USING NOT NULL;
ALTER TABLE "UserInstReport" ALTER "reportedUrl" TYPE STRING(4096); --USING NOT NULL;
ALTER TABLE "UserInstReport" ALTER "reportedPermalink" TYPE STRING(4096); --USING NOT NULL;

-- AlterTable
ALTER TABLE "Record" ALTER "name" TYPE STRING(128); --USING NOT NULL;