<template>
    <div class="meet-portal-container">
        <div
            ref="portalContainer"
            class="meet-portal"
            :class="{ invisible: !portalVisible }"
            :style="extraStyle"
        >
            <jitsi-meet
                v-if="hasPortal"
                :options="{
                    roomName: currentMeet,
                    interfaceConfigOverwrite: interfaceConfig,
                    configOverwrite: config,
                }"
                @closed="onClose"
            ></jitsi-meet>
        </div>
        <div ref="otherContainer" class="other-container">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./MeetPortal.ts"></script>
<style src="./MeetPortal.css" scoped></style>
