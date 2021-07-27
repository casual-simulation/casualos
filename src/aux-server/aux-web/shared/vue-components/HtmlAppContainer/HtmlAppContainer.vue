<template>
    <div class="html-portals-container">
        <div v-for="app in apps" :key="app.key">
            <html-app
                v-if="app.type === 'html'"
                :simulationId="app.simulationId"
                :appId="app.appId"
                :taskId="app.taskId"
            ></html-app>
        </div>
    </div>
</template>
<script src="./HtmlAppContainer.ts"></script>
<style src="./HtmlAppContainer.css" scoped></style>
