<template>
    <div class="meet-portal-container">
        <div
            ref="portalContainer"
            class="meet-portal"
            :class="{ invisible: !portalVisible }"
            :style="extraStyle"
        >
            <jitsi-meet ref="jitsiMeet" v-if="hasPortal" :options="jitsiOptions" @closed="onClose" @videoConferenceJoined="onMeetJoined" @videoConferenceLeft="onMeetLeft" />
        </div>
        <div ref="otherContainer" class="other-container">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./MeetPortal.ts"></script>
<style src="./MeetPortal.css" scoped></style>
