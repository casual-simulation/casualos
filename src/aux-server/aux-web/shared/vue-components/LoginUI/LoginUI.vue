<template>
    <div>
        <login-endpoint v-for="endpoint in endpoints" :key="endpoint" :endpoint="endpoint">
        </login-endpoint>
    </div>
</template>
<script src="./LoginUI.ts"></script>
<style src="./LoginUI.css" scoped></style>
<style src="./LoginUIGlobal.css"></style>
