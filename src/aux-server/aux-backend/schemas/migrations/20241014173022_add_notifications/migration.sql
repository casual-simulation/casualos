-- CreateTable
CREATE TABLE "NotificationRecord" (
    "recordName" STRING(128) NOT NULL,
    "address" STRING(512) NOT NULL,
    "description" STRING(2048),
    "markers" STRING[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("recordName","address")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" UUID NOT NULL,
    "endpoint" STRING(1024) NOT NULL,
    "keys" JSONB NOT NULL,
    "active" BOOL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscriptionUser" (
    "pushSubscriptionId" UUID NOT NULL,
    "userId" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscriptionUser_pkey" PRIMARY KEY ("pushSubscriptionId","userId")
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "notificationAddress" STRING(512) NOT NULL,
    "userId" STRING,
    "pushSubscriptionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentNotification" (
    "id" UUID NOT NULL,
    "recordName" STRING(128) NOT NULL,
    "notificationAddress" STRING(512) NOT NULL,
    "title" STRING(128) NOT NULL,
    "body" STRING(512) NOT NULL,
    "icon" STRING(1024),
    "badge" STRING(1024),
    "silent" BOOL,
    "tag" STRING(128),
    "topic" STRING(128),
    "defaultAction" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "sentTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentPushNotification" (
    "id" UUID NOT NULL,
    "sentNotificationId" UUID NOT NULL,
    "subscriptionId" UUID,
    "userId" STRING,
    "pushSubscriptionId" UUID,
    "success" BOOL NOT NULL,
    "errorCode" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentPushNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PushSubscription_active_idx" ON "PushSubscription"("active");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_recordName_notificationAddress_use_key" ON "NotificationSubscription"("recordName", "notificationAddress", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_recordName_notificationAddress_pus_key" ON "NotificationSubscription"("recordName", "notificationAddress", "pushSubscriptionId");

-- AddForeignKey
ALTER TABLE "NotificationRecord" ADD CONSTRAINT "NotificationRecord_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscriptionUser" ADD CONSTRAINT "PushSubscriptionUser_pushSubscriptionId_fkey1" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscriptionUser" ADD CONSTRAINT "PushSubscriptionUser_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_notificationAddress_fkey1" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotification" ADD CONSTRAINT "SentNotification_recordName_fkey1" FOREIGN KEY ("recordName") REFERENCES "Record"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentNotification" ADD CONSTRAINT "SentNotification_notificationAddress_fkey1" FOREIGN KEY ("recordName", "notificationAddress") REFERENCES "NotificationRecord"("recordName", "address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentPushNotification" ADD CONSTRAINT "SentNotificationUser_sentNotificationId_fkey1" FOREIGN KEY ("sentNotificationId") REFERENCES "SentNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentPushNotification" ADD CONSTRAINT "SentNotificationUser_subscriptionId_fkey1" FOREIGN KEY ("subscriptionId") REFERENCES "NotificationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentPushNotification" ADD CONSTRAINT "SentNotificationUser_userId_fkey1" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentPushNotification" ADD CONSTRAINT "SentNotificationUser_pushSubscriptionId_fkey1" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
