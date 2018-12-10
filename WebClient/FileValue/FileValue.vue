<template>
    <input @input="valueChanged(file, tag, $event.target.value)" :value="value">
</template>
<script src="./FileValue.ts"></script>
<style src="./FileValue.css"></style>