<template>
    <div>
        <enter-address-dialog
            v-if="page === 'enter_address'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        ></enter-address-dialog>
        <check-address-dialog
            v-else-if="page === 'check_address'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        >
        </check-address-dialog>
        <has-account-dialog
            v-else-if="page === 'has_account'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        >
        </has-account-dialog>
        <enter-account-info-dialog
            v-else-if="page === 'enter_privo_account_info'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        >
        </enter-account-info-dialog>
        <update-password-link-dialog
            v-else-if="page === 'show_update_password_link'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        >
        </update-password-link-dialog>
        <register-webauthn-dialog
            v-else-if="page === 'show_register_webauthn'"
            :endpoint="endpoint"
            :status="loginUIStatus"
            @close="closeDialog()"
        >
        </register-webauthn-dialog>
    </div>
</template>
<script src="./LoginEndpointUI.ts"></script>
<style src="./LoginEndpointUI.css" scoped></style>
<style src="./LoginEndpointUIGlobals.css"></style>
