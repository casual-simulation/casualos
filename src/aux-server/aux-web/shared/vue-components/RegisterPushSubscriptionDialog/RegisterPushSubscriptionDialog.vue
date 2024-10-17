<template>
    <md-dialog
        :md-active.sync="showRegisterPushSubscription"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
        @md-closed="onClose()"
    >
        <md-dialog-title>Register Device for Notifications?</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <p>You have subscribed for push notifications on another device.</p>
                    <p>Do you want to receive notifications on this device?</p>
                    <p>
                        Learn more
                        <a
                            href="https://www.howtogeek.com/751954/what-are-push-notifications/"
                            target="_blank"
                            referrerpolicy="no-referrer"
                            >here.</a
                        >
                    </p>
                    <field-errors :errors="errors" :field="null" />
                </div>
            </div>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button @click="onClose()" :disabled="processing">Close</md-button>
            <md-button @click="addDevice" class="md-primary" :disabled="processing">
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Register Device</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./RegisterPushSubscriptionDialog.ts"></script>
<style src="./RegisterPushSubscriptionDialog.css" scoped></style>
<style src="./RegisterPushSubscriptionDialogGlobals.css"></style>
