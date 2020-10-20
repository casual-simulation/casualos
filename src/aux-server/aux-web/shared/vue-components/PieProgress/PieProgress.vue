<template>
    <svg viewBox="0 0 32 32" :style="{ background: backgroundColor }">
        <circle
            :style="{
                fill: color,
                stroke: backgroundColor,
                'stroke-dasharray': progress * 100 + ' 100',
            }"
            r="16"
            cx="16"
            cy="16"
        />
    </svg>
</template>
<script src="./PieProgress.ts"></script>
<style src="./PieProgress.css" scoped></style>
