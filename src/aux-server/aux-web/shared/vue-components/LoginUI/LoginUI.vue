<template>
    <div>
        <login-endpoint v-for="endpoint in endpoints" :key="endpoint" :endpoint="endpoint">
        </login-endpoint>
    </div>
</template>
<script src="./RecordsUI.ts"></script>
<style src="./RecordsUI.css" scoped></style>
<style src="./RecordsUIGlobal.css"></style>
