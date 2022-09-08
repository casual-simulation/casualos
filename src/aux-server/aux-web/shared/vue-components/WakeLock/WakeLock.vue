<template>
    <md-dialog-confirm
        :md-active.sync="showDialog"
        class="enable-wake-lock-dialog"
        md-title="Enable Wake Lock?"
        md-content="Do you want CasualOS to keep your screen awake?"
        md-confirm-text="Yes"
        md-cancel-text="No"
        @md-confirm="onConfirm"
        @md-cancel="onCancel"
    />
</template>
<script src="./WakeLock.ts"></script>
<style src="./WakeLock.css" scoped></style>
