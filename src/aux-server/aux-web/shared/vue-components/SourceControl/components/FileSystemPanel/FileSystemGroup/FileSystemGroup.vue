<!-- <template></template> -->
<style>
.file-system-group {
    box-sizing: border-box;
}

.file-system-group > * {
    margin-right: 5px;
}

.file-system-group > :not(:first-child) {
    margin-left: 8px;
}

.file-system-group-content {
    padding-left: 4px;
}

.file-system-group-item {
    display: flex;
    border-left: 2px solid rgba(128, 128, 128, 0.5);
    height: fit-content;
}

.file-system-group-item-index {
    align-self: center;
    background: rgba(128, 128, 128, 0.5);
    width: 8px;
    height: 1.5px;
    margin: 0 4px 0 2px;
}
</style>
<script src="./FileSystemGroup.ts"></script>
