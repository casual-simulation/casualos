<template>
    <div>
        <md-dialog :md-active.sync="open" @md-closed="closeDialog()" md-theme="default">
            <div class="html-iframe-container">
                <iframe
                    class="html-iframe"
                    :srcdoc="html"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    allowFullscreen
                ></iframe>
            </div>
            <md-dialog-actions>
                <md-button @click="closeDialog()">Close</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./HtmlModal.ts"></script>
<style src="./HtmlModal.css" scoped></style>
