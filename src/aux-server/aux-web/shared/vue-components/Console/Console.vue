<template>
    <div class="console">
        <div class="console-toolbar">
            Console
            <md-button class="close-button md-dense md-icon-button" @click="close()">
                <md-icon>close</md-icon>
            </md-button>
        </div>
        <div class="messages">
            <console-message
                v-for="(message, index) in consoleMessages"
                :key="index"
                :message="message"
            ></console-message>
        </div>
    </div>
</template>
<script src="./Console.ts"></script>
<style scoped src="./Console.css" />
