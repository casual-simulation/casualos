<template>
    <div class="tooltips-container">
        <div v-for="tooltip in tooltips" :key="tooltip.id" :style="tooltip.style" class="aux-tooltip" :class="{ 'exit': tooltip.hidden }">
            {{ tooltip.message }}
        </div>
    </div>
</template>
<script src="./Tooltips.ts"></script>
<style src="./Tooltips.css" scoped></style>
