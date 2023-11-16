<template>
    <div>
        <enter-address-dialog
            v-if="page === 'enter_address'"
            :endpoint="endpoint"
            :status="loginUIStatus"
        ></enter-address-dialog>
        <check-address-dialog
            v-else-if="page === 'check_address'"
            :endpoint="endpoint"
            :status="loginUIStatus"
        >
        </check-address-dialog>
        <has-account-dialog
            v-else-if="page === 'has_account'"
            :endpoint="endpoint"
            :status="loginUIStatus"
        >
        </has-account-dialog>
        <enter-account-info-dialog
            v-else-if="page === 'enter_privo_account_info'"
            :endpoint="endpoint"
            :status="loginUIStatus"
        >
        </enter-account-info-dialog>
        <show-update-password-link-dialog
            v-else-if="page === 'show_update_password_link'"
            :endpoint="endpoint"
            :status="loginUIStatus"
        >
        </show-update-password-link-dialog>
    </div>
</template>
<script src="./LoginEndpointUI.ts"></script>
<style src="./LoginEndpointUI.css" scoped></style>
<style src="./LoginEndpointUIGlobals.css"></style>
