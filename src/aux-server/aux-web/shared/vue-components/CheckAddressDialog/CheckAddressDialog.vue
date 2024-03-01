<template>
    <md-dialog
        :md-active.sync="showCheckAddress"
        :md-close-on-esc="false"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        @md-closed="hideCheckAddress(true)"
        class="input-dialog"
    >
        <md-dialog-title>{{ checkAddressTitle }}</md-dialog-title>
        <md-dialog-content>
            <p>
                We sent a login code to <strong>{{ addressToCheck }}</strong
                >. <span v-if="showCode">Enter it below to complete login.</span
                ><span v-else>Click the included link to complete login.</span>
            </p>
            <md-field v-if="showCode" :class="codeFieldClass">
                <label>Code</label>
                <md-input
                    v-model="loginCode"
                    @keydown.enter.native="sendCode()"
                    inputmode="decimal"
                    autocomplete="one-time-code"
                ></md-input>
                <field-errors field="code" :errors="formErrors" />
            </md-field>

            <field-errors :field="null" :errors="formErrors" />
        </md-dialog-content>
        <md-dialog-actions>
            <md-button @click="hideCheckAddress()">Cancel</md-button>
            <md-button
                v-if="showCode"
                class="md-primary"
                @click="sendCode()"
                :disabled="processing"
            >
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Send</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./CheckAddressDialog.ts"></script>
<style src="./CheckAddressDialog.css" scoped></style>
<style src="./CheckAddressDialogGlobals.css"></style>
