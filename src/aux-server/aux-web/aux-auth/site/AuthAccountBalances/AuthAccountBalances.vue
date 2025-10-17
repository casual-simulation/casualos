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

        <div
            v-if="!loading && !error && Object.keys(balances).length > 0"
            class="balances-container"
        >
            <md-card>
                <md-card-header data-background-color="green">
                    <h4 class="title">Account Balances</h4>
                </md-card-header>

                <md-card-content>
                    <table class="balances-table">
                        <thead>
                            <tr>
                                <th>Currency</th>
                                <th>Credits</th>
                                <th>Debits</th>
                                <th>Pending Credits</th>
                                <th>Pending Debits</th>
                                <th>Account ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in filteredBalances" :key="item.currency">
                                <td>{{ item.currency }}</td>
                                <td>{{ formatBalance(item.balance.credits) }}</td>
                                <td>{{ formatBalance(item.balance.debits) }}</td>
                                <td>{{ formatBalance(item.balance.pendingCredits) }}</td>
                                <td>{{ formatBalance(item.balance.pendingDebits) }}</td>
                                <td class="account-id">{{ item.balance.accountId }}</td>
                            </tr>
                        </tbody>
                    </table>
                </md-card-content>
            </md-card>
        </div>

        <div v-if="!loading && !error && Object.keys(balances).length === 0" class="empty-state">
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
