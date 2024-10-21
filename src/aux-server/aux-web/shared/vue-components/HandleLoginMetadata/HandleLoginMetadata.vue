<template>
    <div>
        <register-webauthn-dialog
            v-if="showRegisterWebAuthn"
            :endpoint="currentEndpoint"
            :status="currentStatus"
            @close="onCloseWebAuthn()"
        >
        </register-webauthn-dialog>
        <register-push-subscription-dialog
            v-else-if="showRegisterPushSubscription"
            :endpoint="currentEndpoint"
            :status="currentStatus"
            @close="onClosePushSubscription()"
        ></register-push-subscription-dialog>
    </div>
</template>
<script src="./HandleLoginMetadata.ts"></script>
<style src="./HandleLoginMetadata.css" scoped></style>
