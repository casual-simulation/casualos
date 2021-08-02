<template>
    <div>
        <md-button v-if="!hasAvatar" @click="createAvatar = true">Create Avatar</md-button>

        <p v-if="hasAvatar">You have an avatar! {{ avatarUrl }}</p>

        <md-dialog class="avatar-dialog" :md-active.sync="createAvatar">
            <md-dialog-content>
                <iframe :src="iframeUrl"></iframe>
            </md-dialog-content>
        </md-dialog>
    </div>
</template>
<script src="./AuthAvatar.ts"></script>
<style src="./AuthAvatar.css" scoped></style>
