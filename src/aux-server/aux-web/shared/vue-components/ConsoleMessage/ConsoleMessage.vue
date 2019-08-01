<template>
    <div class="message" :class="[type]">
        <span v-for="(m, idx) in message.messages" :key="idx">{{ m }}</span>
    </div>
</template>
<script src="./ConsoleMessage.ts"></script>
<style scoped src="./ConsoleMessage.css" />
