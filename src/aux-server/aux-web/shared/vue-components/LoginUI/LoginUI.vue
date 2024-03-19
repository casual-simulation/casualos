<template>
    <div>
        <login-endpoint
            v-for="endpoint in endpoints"
            :key="endpoint"
            :endpoint="endpoint"
            @close="onClose(endpoint)"
        >
        </login-endpoint>
    </div>
</template>
<script src="./LoginUI.ts"></script>
<style src="./LoginUI.css" scoped></style>
<style src="./LoginUIGlobals.css"></style>
