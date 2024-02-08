<template>
    <md-dialog-confirm
        :md-active.sync="showDialog"
        class="enable-xr-dialog"
        :md-title="title"
        :md-content="content"
        md-confirm-text="Yes"
        md-cancel-text="No"
        @md-confirm="onConfirm"
        @md-cancel="onCancel"
    />
</template>
<script src="./EnableXRModal.ts"></script>
<style src="./EnableXRModal.css" scoped></style>
