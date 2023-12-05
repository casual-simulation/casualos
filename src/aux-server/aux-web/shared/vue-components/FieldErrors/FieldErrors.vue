<template>
    <div>
        <span v-for="(err, index) of fieldErrors" :key="index" class="md-error">{{
            err.errorMessage
        }}</span>
    </div>
</template>
<script src="./FieldErrors.ts"></script>
<style src="./FieldErrors.css"></style>
