<template>
    <div v-if="hasPortal" class="meet-portal">
        <jitsi-meet :options="{ roomName: currentMeet }" @closed="onClose"></jitsi-meet>
    </div>
</template>
<script src="./MeetPortal.ts"></script>
<style src="./MeetPortal.css" scoped></style>
