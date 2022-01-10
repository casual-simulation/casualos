<template>
    <div
        class="bot-search"
        v-shortkey.once="['ctrl', 'f']"
        @shortkey="startChat()"
        :style="styleVariables"
    >
        <md-field class="chat-input" md-inline>
            <label>{{ finalPlaceholder }}</label>
            <md-input
                class="search-input"
                ref="searchInput"
                v-model="text"
                @input="onTextUpdated()"
                v-on:keyup.enter="sendMessage(false)"
            ></md-input>
        </md-field>
        <md-button v-show="text" class="md-icon-button" @click="sendMessage(true)">
            <md-icon>send</md-icon>
            <md-tooltip md-direction="bottom">Send Message</md-tooltip>
        </md-button>
        <md-button class="md-icon-button login-button" @click="login()">
            <md-progress-spinner
                v-if="isLoggingIn"
                md-mode="indeterminate"
                :md-diameter="20"
                :md-stroke="2"
            ></md-progress-spinner>
            <md-icon v-else-if="!isLoggedIn">login</md-icon>
            <md-icon v-else-if="isLoggedIn && !avatarUrl">perm_identity</md-icon>
            <img v-else :src="avatarUrl" />
        </md-button>
    </div>
</template>
<script src="./BotChat.ts"></script>
<style src="./BotChat.css" scoped></style>
