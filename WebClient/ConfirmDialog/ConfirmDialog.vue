<template>
    <div>
        <md-dialog-confirm
        :md-active.sync="active"
        md-title="options.title"
        md-content="options.body"
        md-confirm-text="OK"
        md-cancel-text="Cancel"
        @md-cancel="cancelClicked"
        @md-confirm="okClicked" />
    </div>
</template>
<script src="./ConfirmDialog.ts"></script>
<style src="./ConfirmDialog.css"></style>