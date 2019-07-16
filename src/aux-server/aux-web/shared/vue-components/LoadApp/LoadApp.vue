<template>
    <div>
        <loading
            v-if="loadingState"
            :status="loadingState.message"
            :progress="loadingState.progress * 100"
            :show="loadingState && !loadingState.done"
        >
        </loading>
        <div v-if="!loading">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./LoadApp.ts"></script>
<style scoped src="./LoadApp.css" />
