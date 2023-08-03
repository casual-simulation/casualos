<template>
    <div class="studio-container">
        <h2>{{ studioName }}</h2>
        <auth-subscription :studioId="studioId" />
    </div>
</template>
<script src="./AuthStudio.ts"></script>
<style src="./AuthStudio.css" scoped></style>
