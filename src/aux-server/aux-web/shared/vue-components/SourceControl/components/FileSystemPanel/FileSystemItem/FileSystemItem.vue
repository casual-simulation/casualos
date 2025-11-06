<template>
    <div class="file-system-item">
        <div
            class="file-system-item-header"
            :style="{ borderRight: `4px solid ${itemStatusColor}` }"
        >
            <md-icon>{{ iconName }}</md-icon>
            <span>{{ name }}</span>
        </div>
        <div class="file-system-item-meta">
            <span
                ><i>{{ metaMessage }}</i></span
            >
        </div>
    </div>
</template>

<style></style>

<script src="./FileSystemItem.ts"></script>
