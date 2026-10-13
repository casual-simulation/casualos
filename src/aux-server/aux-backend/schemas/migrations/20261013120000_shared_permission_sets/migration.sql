-- AlterTable
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "permissions" JSONB;
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "recipientPermissionAssignmentIds" UUID[];
ALTER TABLE "public"."SharedPermission" ADD COLUMN     "requestingPermissionAssignmentIds" UUID[];

-- Convert each existing shared permission into a set that contains its single permission.
UPDATE "public"."SharedPermission" SET
    "permissions" = jsonb_build_array("permission"),
    "requestingPermissionAssignmentIds" = CASE WHEN "requestingPermissionAssignmentId" IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY["requestingPermissionAssignmentId"] END,
    "recipientPermissionAssignmentIds" = CASE WHEN "recipientPermissionAssignmentId" IS NULL THEN ARRAY[]::UUID[] ELSE ARRAY["recipientPermissionAssignmentId"] END;

-- AlterTable
ALTER TABLE "public"."SharedPermission" ALTER COLUMN "permissions" SET NOT NULL;
ALTER TABLE "public"."SharedPermission" DROP COLUMN "permission";
ALTER TABLE "public"."SharedPermission" DROP COLUMN "recipientPermissionAssignmentId";
ALTER TABLE "public"."SharedPermission" DROP COLUMN "requestingPermissionAssignmentId";
