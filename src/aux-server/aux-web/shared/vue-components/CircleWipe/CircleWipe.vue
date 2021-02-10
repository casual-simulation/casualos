<template>
    <svg
        :class="{ open: open, closed: !open }"
        :style="{ stroke: color }"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        version="1.1"
    >
        <circle
            :style="{ 'transition-duration': transitionDuration }"
            cx="50"
            cy="50"
            r="75"
            fill="transparent"
        />
    </svg>
</template>
<script src="./CircleWipe.ts"></script>
<style src="./CircleWipe.css" scoped></style>
