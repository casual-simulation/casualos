<template>
    <file-system-group v-if="(nodeData?.items?.length ?? 0) == 0">
        <file-system-directory :name="nodeData?.dirName ?? ''" />
        <div
            class="file-system-message-box"
            v-if="nodeData?.items === null || (nodeData?.items?.length ?? 0) == 0"
        >
            <span>No items here...</span>
        </div>
    </file-system-group>
    <file-system-group v-else>
        <file-system-directory :name="nodeData?.dirName ?? ''" />
        <div class="file-system-message-box">
            <span>No items here...</span>
        </div>
        <file-system-node
            v-for="fItem in nodeData?.childItems?.filter((i) => i instanceof VDir)"
            :key="fItem.dirName"
            :node-data="fItem"
        />
        <file-system-item
            v-for="fItem in nodeData?.childItems?.filter((i) => i instanceof VFile)"
            :key="fItem.name"
        ></file-system-item>
    </file-system-group>
</template>

<script src="./FileSystemNode.ts"></script>
