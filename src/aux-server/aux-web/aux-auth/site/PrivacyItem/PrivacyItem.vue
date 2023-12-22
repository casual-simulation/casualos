<template>
    <li>
        <md-tooltip>{{ tooltip }}</md-tooltip> <md-icon v-if="value" class="allowed">done</md-icon
        ><md-icon v-else class="denied">close</md-icon> <slot />
    </li>
</template>
<script src="./PrivacyItem.ts"></script>
<style src="./PrivacyItem.css" scoped></style>
