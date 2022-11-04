<template>
    <span
        >{{ text.slice(0, startIndex) }}<mark>{{ text.slice(startIndex, endIndex) }}</mark
        >{{ text.slice(endIndex) }}</span
    >
</template>
<script src="./HighlightedText.ts"></script>
<style src="./HighlightedText.css"></style>
