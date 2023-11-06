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
            <md-tab md-label="Policies" :to="{ name: 'records-policies', params: { recordName } }">
                <records-policies :recordName="recordName"></records-policies>
            </md-tab>
            <md-tab md-label="Roles" :to="{ name: 'records-roles', params: { recordName } }">
                <records-roles :recordName="recordName"></records-roles>
            </md-tab>
        </md-tabs>
    </div>
</template>
<script src="./AuthRecords.ts"></script>
<style src="./AuthRecords.css" scoped></style>
