<template>
    <div>
        <md-dialog :md-active.sync="showNotAuthorized" class="not-authorized-dialog">
            <md-dialog-title>Not Authorized</md-dialog-title>
            <md-dialog-content>
                <p>You are not authorized to view this inst.</p>
            </md-dialog-content>
            <md-dialog-actions></md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthUI.ts"></script>
<style src="./AuthUI.css"></style>
