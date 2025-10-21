<template>
    <div>
        <md-dialog-alert
            :md-active.sync="showAlertDialog"
            :md-content="content"
            :md-title="title"
            :md-confirm-text="dismissText"
            :md-fullscreen="true"
            class="alert-dialog"
            @md-confirm="onDismiss"
        />
    </div>
</template>
<script src="./ShowAlertModal.ts"></script>
<style src="./ShowAlertModal.css" scoped></style>
