<template>
    <div class="html-portals-container">
        <div v-for="portal in portals" :key="`${portal.simulationId}-${portal.portalId}`">
            <html-portal
                v-if="portal.type === 'html'"
                :simulationId="portal.simulationId"
                :portalId="portal.portalId"
                :taskId="portal.taskId"
            ></html-portal>
        </div>
    </div>
</template>
<script src="./HtmlPortalContainer.ts"></script>
<style src="./HtmlPortalContainer.css" scoped></style>
