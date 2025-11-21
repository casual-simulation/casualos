<template>
    <div>
        <md-table v-model="items.mdData" md-card md-fixed-header @md-selected="onItemClick">
            <md-table-toolbar>
                <h1 class="md-title">Contracts</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No contracts found"
                :md-description="`No contracts found for this query.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="ID" md-sort-by="id">{{ item.id }}</md-table-cell>
                    <md-table-cell md-label="Status" md-sort-by="status">{{
                        item.status
                    }}</md-table-cell>
                    <md-table-cell md-label="Issuer" md-sort-by="issuingUserId">{{
                        item.issuingUserId
                    }}</md-table-cell>
                    <md-table-cell md-label="Holder" md-sort-by="holdingUserId">{{
                        item.holdingUserId
                    }}</md-table-cell>
                    <md-table-cell md-label="Rate" md-sort-by="rate"
                        >${{ (item.rate / 100).toFixed(2) }}</md-table-cell
                    >
                    <!-- <md-table-cell md-label="Balance" md-sort-by="initialValue">{{
                        item.
                    }}</md-table-cell> -->
                    <md-table-cell md-label="Markers" md-sort-by="markers">
                        <auth-marker
                            v-for="marker in item.markers"
                            :key="marker"
                            :marker="marker"
                            @click="onMarkerClick(marker)"
                        ></auth-marker>
                    </md-table-cell>
                    <md-table-cell md-label="Options">
                        <md-menu md-align-trigger>
                            <md-button md-menu-trigger class="md-icon-button">
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Item Options</span>
                                <md-tooltip>Item Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="openInvoiceDialog(item)"
                                    >Invoice Contract</md-menu-item
                                >
                                <md-menu-item @click="openCancelContractDialog(item)"
                                    >Cancel Contract</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
                    </md-table-cell>
                </md-table-row>
            </template>

            <template v-slot:md-table-pagination v-if="items.mdData.length > 0">
                <div class="md-table-pagination">
                    <span>{{ items.startIndex }}-{{ items.endIndex }} of {{ items.mdCount }}</span>

                    <md-button
                        class="md-icon-button md-table-pagination-previous"
                        @click="changePage(-1)"
                        :disabled="items.mdPage === 1"
                    >
                        <md-icon>keyboard_arrow_left</md-icon>
                    </md-button>

                    <md-button
                        class="md-icon-button md-table-pagination-next"
                        @click="changePage(+1)"
                        :disabled="items.endIndex + 1 >= items.mdCount"
                    >
                        <md-icon>keyboard_arrow_right</md-icon>
                    </md-button>
                </div>
            </template>
        </md-table>

        <div v-if="selectedItem" class="contract-details-container">
            <md-card>
                <md-card-header>
                    <div class="md-title">Contract Details: {{ selectedItem.id }}</div>
                </md-card-header>

                <md-card-content>
                    <div class="details-grid">
                        <div class="detail-item">
                            <strong>Status:</strong>
                            <span>{{ selectedItem.status }}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Issuing User:</strong>
                            <span>{{ selectedItem.issuingUserId }}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Holding User:</strong>
                            <span>{{ selectedItem.holdingUserId }}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Rate:</strong>
                            <span>${{ (selectedItem.rate / 100).toFixed(2) }}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Initial Value:</strong>
                            <span>${{ (selectedItem.initialValue / 100).toFixed(2) }}</span>
                        </div>
                        <div class="detail-item">
                            <strong>Issued At:</strong>
                            <span>{{ new Date(selectedItem.issuedAtMs).toLocaleString() }}</span>
                        </div>
                        <div v-if="selectedItem.closedAtMs" class="detail-item">
                            <strong>Closed At:</strong>
                            <span>{{ new Date(selectedItem.closedAtMs).toLocaleString() }}</span>
                        </div>
                        <div v-if="selectedItem.description" class="detail-item">
                            <strong>Description:</strong>
                            <span>{{ selectedItem.description }}</span>
                        </div>
                    </div>
                </md-card-content>
                <md-card-actions>
                    <md-button
                        v-if="selectedItem.status === 'open'"
                        class="md-primary"
                        @click="openInvoiceDialog(selectedItem)"
                    >
                        Create Invoice
                    </md-button>
                </md-card-actions>
            </md-card>

            <auth-balances :contractId="selectedItem.id"></auth-balances>

            <md-card class="invoices-card">
                <md-card-header>
                    <div class="md-title">Invoices</div>
                </md-card-header>

                <md-progress-bar v-if="invoicesLoading" md-mode="indeterminate"></md-progress-bar>

                <md-card-content>
                    <div
                        v-if="contractInvoices.length === 0 && !invoicesLoading"
                        class="no-invoices"
                    >
                        <p>No invoices for this contract</p>
                    </div>

                    <md-table
                        v-else-if="contractInvoices.length > 0"
                        v-model="contractInvoices"
                        md-card
                    >
                        <template v-slot:md-table-row="{ item: invoice }">
                            <md-table-row>
                                <md-table-cell md-label="ID">{{ invoice.id }}</md-table-cell>
                                <md-table-cell md-label="Amount"
                                    >${{ (invoice.amount / 100).toFixed(2) }}</md-table-cell
                                >
                                <md-table-cell md-label="Status">{{
                                    invoice.status
                                }}</md-table-cell>
                                <md-table-cell md-label="Payout Destination">{{
                                    invoice.payoutDestination
                                }}</md-table-cell>
                                <md-table-cell md-label="Opened At">{{
                                    new Date(invoice.openedAtMs).toLocaleString()
                                }}</md-table-cell>
                                <md-table-cell md-label="Note" v-if="invoice.note">{{
                                    invoice.note
                                }}</md-table-cell>
                                <md-table-cell md-label="Options" class="options-cell">
                                    <md-menu v-if="invoice.status === 'open'" md-align-trigger>
                                        <md-button md-menu-trigger class="md-icon-button">
                                            <md-icon>more_vert</md-icon>
                                            <span class="sr-only">Invoice Options</span>
                                            <md-tooltip>Invoice Options</md-tooltip>
                                        </md-button>
                                        <md-menu-content>
                                            <md-menu-item @click="openCancelInvoiceDialog(invoice)"
                                                >Cancel Invoice</md-menu-item
                                            >
                                        </md-menu-content>
                                    </md-menu>
                                </md-table-cell>
                            </md-table-row>
                        </template>
                    </md-table>
                </md-card-content>
            </md-card>
        </div>

        <auth-permissions
            :recordName="recordName"
            :marker="permissionsMarker"
            :resourceKind="permissionsResourceKind"
            :resourceId="permissionsResourceId"
        >
        </auth-permissions>

        <md-dialog :md-active.sync="showInvoiceDialog" @md-closed="closeInvoiceDialog()">
            <md-dialog-title>Invoice Contract</md-dialog-title>
            <md-dialog-content>
                <p v-if="invoiceContractItem">
                    Invoicing Contract ID: <strong>{{ invoiceContractItem.id }}</strong>
                </p>

                <md-field class="md-block">
                    <label>Amount (must be positive integer)</label>
                    <md-input
                        v-model.number="invoiceAmount"
                        type="number"
                        min="1"
                        step="1"
                    ></md-input>
                </md-field>

                <md-field class="md-block">
                    <label>Note (optional)</label>
                    <md-textarea v-model="invoiceNote"></md-textarea>
                </md-field>

                <md-field class="md-block">
                    <label>Payout Destination</label>
                    <md-select v-model="invoicePayoutDestination">
                        <md-option value="account">Account</md-option>
                        <md-option value="stripe">Stripe</md-option>
                    </md-select>
                </md-field>

                <div v-if="invoiceErrorCode" class="md-error-message">
                    <p>Error: {{ invoiceErrorCode }}</p>
                </div>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="closeInvoiceDialog()">Cancel</md-button>
                <md-button
                    class="md-primary"
                    @click="submitInvoice()"
                    :disabled="!invoiceAmount || invoiceLoading"
                >
                    <md-progress-spinner
                        v-if="invoiceLoading"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                    ></md-progress-spinner>
                    <span v-else>Invoice</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showCancelInvoiceDialog"
            @md-closed="closeCancelInvoiceDialog()"
        >
            <md-dialog-title>Cancel Invoice</md-dialog-title>
            <md-dialog-content>
                <p v-if="cancelInvoiceItem">
                    Are you sure you want to cancel invoice
                    <strong>{{ cancelInvoiceItem.id }}</strong
                    >?
                </p>
                <p v-if="cancelInvoiceItem">
                    Amount: <strong>${{ cancelInvoiceItem.amount }}</strong>
                </p>
                <p v-if="cancelInvoiceItem && cancelInvoiceItem.note">
                    Note: <strong>{{ cancelInvoiceItem.note }}</strong>
                </p>

                <div v-if="cancelInvoiceErrorMessage" class="md-error-message">
                    <p>Error: {{ cancelInvoiceErrorMessage }}</p>
                </div>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="closeCancelInvoiceDialog()">Keep Invoice</md-button>
                <md-button
                    class="md-primary md-danger"
                    @click="submitCancelInvoice()"
                    :disabled="cancelInvoiceLoading"
                >
                    <md-progress-spinner
                        v-if="cancelInvoiceLoading"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                    ></md-progress-spinner>
                    <span v-else>Cancel Invoice</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showCancelContractDialog"
            @md-closed="closeCancelContractDialog()"
        >
            <md-dialog-title>Cancel Contract</md-dialog-title>
            <md-dialog-content>
                <p v-if="cancelContractItem">
                    Are you sure you want to cancel contract
                    <strong>{{ cancelContractItem.id }}</strong
                    >?
                </p>
                <p v-if="cancelContractItem">
                    Status: <strong>{{ cancelContractItem.status }}</strong>
                </p>
                <p v-if="cancelContractItem">
                    Holder: <strong>{{ cancelContractItem.holdingUserId }}</strong>
                </p>

                <div v-if="cancelContractErrorMessage" class="md-error-message">
                    <p>Error: {{ cancelContractErrorMessage }}</p>
                </div>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="closeCancelContractDialog()">Keep Contract</md-button>
                <md-button
                    class="md-primary md-danger"
                    @click="submitCancelContract()"
                    :disabled="cancelContractLoading"
                >
                    <md-progress-spinner
                        v-if="cancelContractLoading"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                    ></md-progress-spinner>
                    <span v-else>Cancel Contract</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthRecordsContracts.ts"></script>
<style src="./AuthRecordsContracts.css" scoped></style>
