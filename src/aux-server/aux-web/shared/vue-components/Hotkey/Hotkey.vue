<template>
    <div v-if="propagate" v-shortkey="realKeys" @shortkey="trigger"></div>
    <div v-else v-shortkey="realKeys" @shortkey="trigger"></div>
</template>
<script src="./Hotkey.ts"></script>
