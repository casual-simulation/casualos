<template>
    <div class="bot-portal-container">
        <div
            ref="portalContainer"
            class="bot-portal"
            :style="extraStyle"
            v-show="hasPortal"
        >
            <pre>{{ currentBot }}</pre>
        </div>
        <div ref="otherContainer" class="other-container">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./BotPortal.ts"></script>
<style src="./BotPortal.css" scoped></style>
