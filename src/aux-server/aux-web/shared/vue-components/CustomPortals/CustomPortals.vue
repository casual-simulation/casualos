<template>
    <div class="custom-portals-container">
        <custom-portal
            v-for="portal in portals"
            :key="portal.portalId"
            :portalId="portal.portalId"
            :vmOrigin="vmOrigin"
            :source="portal.source"
            :error="portal.error"
            :extraStyle="portal.style"
        >
        </custom-portal>
        <div ref="otherContainer" class="other-container">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./CustomPortals.ts"></script>
<style src="./CustomPortals.css" scoped></style>
