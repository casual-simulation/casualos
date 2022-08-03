<template>
    <md-icon v-if="status === 'added'" class="bot-added-icon">add</md-icon>
    <md-icon v-else-if="status === 'removed'" class="bot-removed-icon">remove</md-icon>
    <svg
        v-else-if="status === 'changed'"
        class="md-icon bot-changed-icon"
        width="24"
        height="24"
        viewBox="0 0 100 100"
    >
        <rect
            x="15"
            y="15"
            width="70"
            height="70"
            rx="8"
            ry="8"
            style="stroke-width: 10; fill: transparent"
        />
        <ellipse cx="50" cy="50" rx="8" ry="8" />
    </svg>
    <span v-else></span>
</template>
<script src="./DiffStatus.ts"></script>
<style src="./DiffStatus.css" scoped></style>
