<template>
    <div>
        <md-dialog-confirm
        :md-active.sync="dialogActive"
        v-bind:md-title="title"
        v-bind:md-content="body"
        md-confirm-text="OK"
        md-cancel-text="Cancel"
        @md-cancel="cancelClicked"
        @md-confirm="okClicked" />
    </div>
</template>
<script src="./ConfirmDialog.ts"></script>
<style src="./ConfirmDialog.css"></style>