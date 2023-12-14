<template>
    <div>
        <span v-if="fieldErrors.length > 0" class="md-error">{{ errorText }}</span>
    </div>
</template>
<script src="./FieldErrors.ts"></script>
<style src="./FieldErrors.css" scoped></style>
