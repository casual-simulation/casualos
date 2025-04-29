<template>
    <div>
        <h2>{{ recordName }}</h2>
        <md-tabs md-sync-route>
            <md-tab md-label="Insts" :to="{ name: 'records-insts', params: { recordName } }">
                <records-insts :recordName="recordName"></records-insts>
            </md-tab>
            <md-tab md-label="Data" :to="{ name: 'records-data', params: { recordName } }">
                <records-data :recordName="recordName"></records-data>
            </md-tab>
            <md-tab md-label="Files" :to="{ name: 'records-files', params: { recordName } }">
                <records-files :recordName="recordName"></records-files>
            </md-tab>
            <md-tab md-label="Events" :to="{ name: 'records-events', params: { recordName } }">
                <records-events :recordName="recordName"></records-events>
            </md-tab>
            <md-tab md-label="Packages" :to="{ name: 'records-packages', params: { recordName } }">
                <records-packages :recordName="recordName"></records-packages>
            </md-tab>
            <md-tab md-label="Roles" :to="{ name: 'records-roles', params: { recordName } }">
                <records-roles :recordName="recordName"></records-roles>
            </md-tab>
            <md-tab md-label="Webhooks" :to="{ name: 'records-webhooks', params: { recordName } }">
                <records-webhooks :recordName="recordName"></records-webhooks>
            </md-tab>
            <md-tab
                md-label="Notifications"
                :to="{ name: 'records-notifications', params: { recordName } }"
            >
                <records-notifications :recordName="recordName"></records-notifications>
            </md-tab>
        </md-tabs>
    </div>
</template>
<script src="./AuthRecords.ts"></script>
<style src="./AuthRecords.css" scoped></style>
