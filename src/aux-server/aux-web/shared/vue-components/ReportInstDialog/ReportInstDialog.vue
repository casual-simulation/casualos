<template>
    <md-dialog
        :md-active.sync="showDialog"
        class="report-inst-dialog"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        @md-closed="onDialogClosed()"
    >
        <md-dialog-title>Report Inst</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <form @submit.prevent="submitReport()">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field :class="reportReasonFieldClass">
                            <label for="reportReason">What is the reason?</label>
                            <md-select v-model="reportReason" name="reportReason" id="reportReason">
                                <md-option value="spam">Spam</md-option>
                                <md-option value="harassment">Harassment</md-option>
                                <md-option value="copyright-infringement"
                                    >Copyright Infringement</md-option
                                >
                                <md-option value="obscene">Obscene</md-option>
                                <md-option value="illegal">Illegal</md-option>
                                <md-option value="other">Other</md-option>
                            </md-select>
                            <field-errors field="reportReason" :errors="errors" />
                        </md-field>

                        <md-field :class="reportReasonTextFieldClass">
                            <label for="reportReasonText"
                                >Describe why you reported this inst.</label
                            >
                            <md-textarea
                                name="reportReasonText"
                                id="reportReasonText"
                                v-model="reportReasonText"
                                :disabled="processing"
                            />
                            <field-errors field="reportReasonText" :errors="errors" />
                        </md-field>
                    </div>
                </div>
                <field-errors :field="null" :errors="errors" />
                <p v-if="privacyPolicyUrl">
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
                <p v-if="termsOfServiceUrl">
                    <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                </p>
            </form>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button @click="hideDialog()"> Cancel </md-button>
            <md-button @click="submitReport()" :disabled="processing">
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Submit Report</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./ReportInstDialog.ts"></script>
<style src="./ReportInstDialog.css" scoped></style>
<style src="./ReportInstDialogGlobals.css"></style>
