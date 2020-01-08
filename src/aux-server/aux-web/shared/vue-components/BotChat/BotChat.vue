<template>
    <div
        class="bot-search"
        :class="{ open: isOpen }"
        v-shortkey.once="['ctrl', 'f']"
        @shortkey="startChat()"
    >
        <md-field md-inline>
            <label>{{ placeholder }}</label>
            <md-input
                class="search-input"
                ref="searchInput"
                v-model="text"
                @input="onTextUpdated()"
                v-on:keyup.enter="sendMessage()"
            ></md-input>
        </md-field>
        <md-button v-show="text" class="md-icon-button" @click="sendMessage()">
            <md-icon>send</md-icon>
            <md-tooltip md-direction="bottom">Send Message</md-tooltip>
        </md-button>
    </div>
</template>
<script src="./BotChat.ts"></script>
<style src="./BotChat.css" scoped></style>
