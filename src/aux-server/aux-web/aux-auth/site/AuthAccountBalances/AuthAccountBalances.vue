<template>
    <div class="auth-account-balances">
        <div v-if="loading" class="loading">
            <md-progress-bar md-mode="indeterminate"></md-progress-bar>
        </div>

        <div v-if="error" class="error">
            <md-card>
                <md-card-content>
                    <p class="error-message">{{ error }}</p>
                </md-card-content>
            </md-card>
        </div>

        <account-balances v-if="hasBalance" :balances="balances"></account-balances>

        <div v-if="!loading && !error && !hasBalance" class="empty-state">
            <md-card>
                <md-card-content>
                    <p>No account balances found.</p>
                </md-card-content>
            </md-card>
        </div>
    </div>
</template>

<script src="./AuthAccountBalances.ts"></script>
<style src="./AuthAccountBalances.css" scoped></style>
