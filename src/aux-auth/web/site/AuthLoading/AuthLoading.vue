<template>
    <div>
        <loading
            v-if="loading"
            :status="''"
            :progress="0"
            :error="null"
            :show="loading"
            :version="version"
        >
        </loading>
    </div>
</template>
<script src="./AuthLoading.ts"></script>
<style src="./AuthLoading.css" scoped></style>
