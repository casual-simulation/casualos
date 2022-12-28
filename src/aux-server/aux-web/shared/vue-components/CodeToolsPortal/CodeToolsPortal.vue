<template>
    <div class="code-tools-portal">
        <md-button
            v-for="tool of tools"
            :key="tool.botId"
            class="code-tool md-dense"
            @click="clickTool(tool)"
        >
            {{ tool.label }}
        </md-button>
    </div>
</template>
<script src="./CodeToolsPortal.ts"></script>
<style src="./CodeToolsPortal.css" scoped></style>
