<template>
    <div v-if="accountBalances.length > 0" class="balances-container">
        <md-card>
            <md-card-header data-background-color="green">
                <h4 class="title">Account Balances</h4>
            </md-card-header>

            <md-card-content>
                <table class="balances-table">
                    <thead>
                        <tr>
                            <th>Currency</th>
                            <th>Balance</th>
                            <th>Account ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in accountBalances" :key="item.currency">
                            <td>{{ item.currency }}</td>
                            <td class="balance">{{ calculateNetBalance(item) }}</td>
                            <td class="account-id">{{ item.accountId }}</td>
                        </tr>
                    </tbody>
                </table>
            </md-card-content>
        </md-card>
    </div>
</template>

<script src="./AccountBalances.ts"></script>
<style src="./AccountBalances.css" scoped></style>
