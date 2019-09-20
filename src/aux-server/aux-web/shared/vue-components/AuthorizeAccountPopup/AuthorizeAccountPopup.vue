<template>
    <div>
        <md-dialog :md-active="show" @md-closed="close()">
            <md-dialog-content>
                <div class="authorize-container">
                    <div class="qr-scanner-container">
                        <h3>Scan your account QR Code</h3>
                        <qrcode-stream @decode="onQRCodeScanned"></qrcode-stream>
                    </div>
                    <div class="enter-code-divider">
                        <span>Or enter it below</span>
                    </div>
                    <div>
                        <md-field>
                            <label for="account_code">Account Code</label>
                            <md-input
                                name="account_code"
                                v-model="code"
                                @keyup.enter="continueWithCode()"
                            ></md-input>
                        </md-field>
                    </div>
                </div>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="cancel()">Close</md-button>
                <md-button class="md-primary md-raised" @click="continueWithCode()">Next</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthorizeAccountPopup.ts"></script>
<style src="./AuthorizeAccountPopup.css" scoped></style>
