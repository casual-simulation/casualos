<template>
    <div :style="position" class="aux-tooltip" :class="{ exit: hidden }">
        <div ref="text" class="aux-tooltip-content">{{ message }}</div>
    </div>
</template>
<script src="./Tooltip.ts"></script>
<style src="./Tooltip.css" scoped></style>
