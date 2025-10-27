<template>
    <div v-if="accountBalances.length > 0" class="balances-container">
        <h3 class="title">Account Balances</h3>

        <div class="balances-list">
            <md-card v-for="item in accountBalances" :key="item.currency" class="balance-card">
                <md-card-header
                    ><h3 class="md-title">{{ getCurrencyName(item.currency) }}</h3></md-card-header
                >
                <md-card-content class="balances-list">
                    <div>
                        <span class="balance">{{ calculateNetBalance(item) }}</span>
                        <span class="balance-description">Available</span>
                    </div>
                    <div v-if="hasPendingBalance(item)">
                        <span class="pending-balance">{{ calculatePendingBalance(item) }}</span>
                        <span class="balance-description">Pending</span>
                    </div>
                </md-card-content>
            </md-card>
        </div>
    </div>
</template>

<script src="./AccountBalances.ts"></script>
<style src="./AccountBalances.css" scoped></style>
