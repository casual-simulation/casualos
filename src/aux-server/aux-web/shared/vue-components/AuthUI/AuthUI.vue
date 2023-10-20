<template>
    <div>
        <md-dialog
            :md-active.sync="showNotAuthorized"
            class="not-authorized-dialog"
            :md-close-on-esc="false"
            :md-click-outside-to-close="false"
            @md-closed="closeNotAuthorized()"
        >
            <md-dialog-title>Not Authorized</md-dialog-title>
            <md-dialog-content>
                <p>You are not authorized to view this inst.</p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="changeLogin()">Change Login</md-button>
                <md-button @click="newInst()">New Inst</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthUI.ts"></script>
<style src="./AuthUI.css"></style>
