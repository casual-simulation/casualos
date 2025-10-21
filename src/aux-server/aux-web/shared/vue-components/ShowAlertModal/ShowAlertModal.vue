<template>
    <div>
        <md-dialog
            :md-active.sync="showAlertDialog"
            :md-fullscreen="true"
            class="alert-dialog"
            @md-closed="onDismiss"
        >
            <md-dialog-title>{{ title }}</md-dialog-title>

            <md-dialog-content>{{ content }}</md-dialog-content>

            <md-dialog-actions>
                <md-button class="md-primary" @click="onDismiss">
                    {{ dismissText }}
                </md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./ShowAlertModal.ts"></script>
<style src="./ShowAlertModal.css" scoped></style>
