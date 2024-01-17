<template>
    <div>
        <md-dialog
            :md-active.sync="showRequestPublicRecord"
            :md-fullscreen="false"
            @md-closed="cancelCreateRecordKey()"
            class="input-dialog"
        >
            <md-dialog-content class="input-dialog-content">
                <p>
                    Do you want to create a {{ requestRecordPolicy }} record key for "{{
                        requestRecordName
                    }}"?
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="createRecordKey(requestRecordName)"
                    >Create Record Key</md-button
                >
                <md-button
                    @click="
                        showRequestPublicRecord = false;
                        requestRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showAllowRecordData"
            :md-fullscreen="false"
            @md-closed="cancelAllowRecordData()"
            class="input-dialog"
        >
            <md-dialog-content class="allow-record-data-dialog-content">
                <p v-if="recordDataEvent && recordDataEvent.type === 'record_data'">
                    Do you want to write the following data to "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                    <code>
                        <pre>{{
                            typeof recordDataEvent.data === 'string'
                                ? recordDataEvent.data
                                : JSON.stringify(recordDataEvent.data)
                        }}</pre>
                    </code>
                </p>
                <p v-else-if="recordDataEvent && recordDataEvent.type === 'get_record_data'">
                    Do you want to get the data from "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                </p>
                <p v-else-if="recordDataEvent && recordDataEvent.type === 'erase_record_data'">
                    Do you want to delete the data stored in "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="allowRecordData()">{{
                    !recordDataEvent
                        ? ''
                        : recordDataEvent.type === 'record_data'
                        ? 'Record Data'
                        : recordDataEvent.type === 'get_record_data'
                        ? 'Get Data'
                        : 'Erase Data'
                }}</md-button>
                <md-button
                    @click="
                        showAllowRecordData = false;
                        allowRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showGrantInstAdminPermission"
            :md-fullscreen="false"
            @md-closed="cancelGrantInstPermission()"
            class="input-dialog"
        >
            <md-dialog-title>Grant inst Admin?</md-dialog-title>
            <md-dialog-content class="allow-record-data-dialog-content">
                <p>
                    This will allow the inst (<strong>{{ grantInstId }}</strong
                    >) to access your personal cloud data (<a
                        target="_blank"
                        :href="grantRecordsOrigin"
                        >{{ grantRecordsOrigin }}</a
                    >, Record Name: {{ allowRecordName }}).
                </p>
                <p>
                    This will allow the inst to perform the following actions when you are logged
                    in:
                </p>
                <ul>
                    <li>Create, read, update, or delete any data in the record.</li>
                    <li>Create, read, update, or delete any files in the record.</li>
                    <li>Increment, read, or update any events in the record.</li>
                    <li>Mark or unmark any resources in the record with any resource markers.</li>
                    <li>List all the resource markers in the record.</li>
                    <li>List all the role assignments in the record.</li>
                    <li>Grant or revoke any permissions to any resource markers.</li>
                    <li>Grant or revoke any roles to any users.</li>
                </ul>
                <p class="important-warning">
                    <strong
                        >Important warning: If you grant this inst Admin access, other public insts
                        may have access to your cloud data if you visit them and it has been
                        programmed to do so. Please be careful when visiting public insts and make
                        sure you know the person sharing, whom you may be sharing with and what
                        permissions they have set.</strong
                    >
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="grantInstPermission()">Grant Admin</md-button>
                <md-button
                    @click="
                        showGrantInstAdminPermission = false;
                        allowRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <!-- <div v-show="showIframe" class="md-overlay md-fixed md-dialog-overlay"></div> -->
    </div>
</template>
<script src="./RecordsUI.ts"></script>
<style src="./RecordsUI.css" scoped></style>
<style src="./RecordsUIGlobal.css"></style>
