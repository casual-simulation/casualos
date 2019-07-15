<template>
    <div>
        <div v-if="loading">
            Loading...
        </div>
        <div v-else>
            <slot></slot>
        </div>
    </div>
</template>
<script src="./LoadApp.ts"></script>
<style scoped src="./LoadApp.css" />
