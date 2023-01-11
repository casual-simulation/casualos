<template>
    <div>
        <md-dialog-confirm
            :md-active.sync="showConfirmDialog"
            :md-title="title"
            :md-content="content"
            :md-confirm-text="confirmText"
            :md-cancel-text="cancelText"
            @md-cancel="onCancel"
            @md-closed="onCancel"
            @md-confirm="onConfirm"
            :md-fullscreen="true"
            class="input-dialog"
        />
    </div>
</template>
<script src="./ShowConfirmModal.ts"></script>
<style src="./ShowConfirmModal.css" scoped></style>
