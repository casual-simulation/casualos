<template>
    <div class="file-system-dir" :style="{ borderLeft: `4px solid ${itemStatusColor}` }">
        <div class="file-system-dir-header">
            <md-icon>{{ iconName }}</md-icon>
            <span>{{ name }}</span>
        </div>
        <div class="file-system-dir-meta">
            <span
                ><i>{{ metaMessage }}</i></span
            >
        </div>
    </div>
</template>

<style>
.file-system-dir {
    border-left: 8px rgb(193, 193, 193) solid;
    background: linear-gradient(50deg, rgba(207, 207, 207, 0.5), rgb(207 207 207 / 0%));
    box-shadow: 0 0 2px #6d6d6d5e;
    padding: 5px;
    margin: 5px;
    display: flex;
    justify-content: space-between;
}

.file-system-dir-header {
    display: flex;
    align-content: baseline;
    align-items: center;
}

.file-system-dir-header > i {
    width: fit-content;
    margin: 2px 4px;
}

.file-system-dir-meta {
    display: flex;
    justify-content: center;
    margin: 0 3px;
}

.file-system-dir-meta > span {
    font-size: 90%;
    font-family: monospace;
    color: grey;
}
</style>

<script src="./FileSystemDirectory.ts"></script>
