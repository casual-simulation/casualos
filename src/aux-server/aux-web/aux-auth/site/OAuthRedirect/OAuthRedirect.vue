<template>
    <div>
        <div v-if="errorMessage">
            <h3>An error occurred</h3>
            <p>{{ errorMessage }}</p>
        </div>
        <div v-else-if="completed">
            <h3>Sign-in authorized</h3>
            <p>You can close this tab and return to the app or terminal to finish signing in.</p>
        </div>
        <md-progress-spinner v-else md-mode="indeterminate" :md-diameter="20" :md-stroke="2"
            >Processing</md-progress-spinner
        >
    </div>
</template>
<script src="./OAuthRedirect.ts"></script>
<style src="./OAuthRedirect.css" scoped></style>
