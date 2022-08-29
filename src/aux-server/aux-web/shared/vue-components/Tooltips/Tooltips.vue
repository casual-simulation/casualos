<template>
    <div class="tooltips-container">
        <tooltip
            v-for="tooltip in tooltips"
            :key="tooltip.id"
            :position="tooltip.style"
            :message="tooltip.message"
            :hidden="tooltip.hidden"
        />
    </div>
</template>
<script src="./Tooltips.ts"></script>
<style src="./Tooltips.css" scoped></style>
