<template>
    <div class="file-system-container">
        <file-system-node :node-data="reactiveStore.visualFS.root"></file-system-node>
    </div>
</template>

<style>
.file-system-container {
    background: linear-gradient(50deg, rgb(243 243 243 / 53%), rgb(237 237 237 / 53%));
    box-shadow: inset 1px 0 4px rgb(155 155 155 / 30%);
    display: flex;
    flex-direction: column;
    padding: 3px;
    font-size: 90%;
}

.file-system-message-box {
    background: linear-gradient(0deg, rgba(232, 232, 232, 0.45), rgba(232, 232, 232, 0.95));
    box-shadow: inset 1px 0 4px rgb(155 155 155 / 30%);
    padding: 5px;
    text-align: center;
    color: grey;
}

@media (prefers-color-scheme: dark) {
    .file-system-container {
        background: linear-gradient(50deg, rgb(32 32 32 / 53%), rgb(48 48 48 / 53%));
        box-shadow: inset 1px 0 4px rgb(0 0 0 / 30%);
    }

    .file-system-message-box {
        background: linear-gradient(0deg, rgba(32, 32, 32, 0.45), rgba(48, 48, 48, 0.95));
        box-shadow: inset 1px 0 4px rgb(0 0 0 / 30%);
        color: lightgrey;
    }
}
</style>

<script src="./FileSystemPanel.ts"></script>
