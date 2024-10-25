<template>
    <div>
        <div v-if="errorMessage">
            <h3>An error occurred</h3>
            <p>{{ errorMessage }}</p>
        </div>
        <md-progress-spinner v-else md-mode="indeterminate" :md-diameter="20" :md-stroke="2"
            >Processing</md-progress-spinner
        >
    </div>
</template>
<script src="./OAuthRedirect.ts"></script>
<style src="./OAuthRedirect.css" scoped></style>
