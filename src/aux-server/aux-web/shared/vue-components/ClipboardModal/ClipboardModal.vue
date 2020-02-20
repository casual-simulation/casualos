<template>
    <div>
        <md-dialog :md-active.sync="open" @md-closed="closeDialog()">
            <md-dialog-title>Copy to clipboard?</md-dialog-title>
            <md-dialog-content>
                <md-field>
                    <label for="clipboard-text">Text</label>
                    <md-textarea id="clipboard-text" v-model="text" md-autogrow readonly />
                </md-field>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="closeDialog()">Close</md-button>
                <md-button class="md-primary" @click="doCopy">Copy!</md-button>
            </md-dialog-actions>
        </md-dialog>
        <hotkey :keys="['ctrl', 'v']" @triggered="onPaste" />
    </div>
</template>
<script src="./ClipboardModal.ts"></script>
<style src="./ClipboardModal.css" scoped></style>
