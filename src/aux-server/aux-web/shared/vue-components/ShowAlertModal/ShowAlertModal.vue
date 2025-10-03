<template>
    <div>
        <md-dialog-alert
            :md-active.sync="showAlertDialog"
            :md-title="title"
            :md-content="content"
            :md-confirm-text="dismissText"
            @md-confirm="onDismiss"
            @md-closed="onDismiss"
            :md-fullscreen="true"
            class="alert-dialog"
        />
    </div>
</template>
<script src="./ShowAlertModal.ts"></script>
<style src="./ShowAlertModal.css" scoped></style>
