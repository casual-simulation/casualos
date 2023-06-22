<template>
    <div>
        <div v-if="hasAvatar">
            <h3>Avatar</h3>
            <p>You have an avatar! {{ avatarUrl }}</p>
            <img v-if="render" class="avatar-img" :src="render" />
        </div>
        <md-button @click="changeAvatar()">
            {{ hasAvatar ? 'Change Avatar' : 'Create Avatar' }}
        </md-button>

        <md-dialog class="avatar-dialog" :md-active.sync="createAvatar">
            <md-dialog-content>
                <md-progress-spinner
                    v-if="createdAvatar"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                ></md-progress-spinner>
                <iframe v-if="!createdAvatar" :src="iframeUrl"></iframe>
            </md-dialog-content>
        </md-dialog>
    </div>
</template>
<script src="./AuthAvatar.ts"></script>
<style src="./AuthAvatar.css" scoped></style>
