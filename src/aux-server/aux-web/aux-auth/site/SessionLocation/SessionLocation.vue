<template>
    <span v-if="session.currentSession">
        <md-tooltip>{{ session.ipAddress }}</md-tooltip>
        <md-icon v-if="session.currentSession">verified_user</md-icon>
        Your current session
    </span>
    <span v-else>
        {{ session.ipAddress }}
    </span>
</template>
<script src="./SessionLocation.ts"></script>
<style src="./SessionLocation.css" scoped></style>
