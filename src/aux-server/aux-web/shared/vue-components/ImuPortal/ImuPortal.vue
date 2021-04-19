<template>
    <div class="imu-portal-container">
        <md-dialog-confirm
            :md-active.sync="showRequestDeviceMotionPermission"
            class="imu-request-dialog"
            md-title="Allow tracking device motion?"
            md-content="This allows CasualOS to read information about your device's spatial orientation."
            md-confirm-text="Yes"
            md-cancel-text="No"
            @md-cancel="onCancelDeviceMotion"
            @md-confirm="onConfirmDeviceMotion"
        />
    </div>
</template>
<script src="./ImuPortal.ts"></script>
<style src="./ImuPortal.css"></style>
