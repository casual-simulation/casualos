<template>
    <div>
        <h2>{{ recordName }}</h2>
        <md-tabs md-sync-route>
            <md-tab md-label="Data" :to="{ name: 'records-data', params: { recordName } }">
                <router-view></router-view>
            </md-tab>
            <md-tab md-label="Files" :to="{ name: 'records-files', params: { recordName } }">
                <router-view></router-view>
            </md-tab>
            <md-tab md-label="Events" :to="{ name: 'records-events', params: { recordName } }">
                <router-view></router-view>
            </md-tab>
            <md-tab md-label="Policies" :to="{ name: 'records-policies', params: { recordName } }">
                <router-view></router-view>
            </md-tab>
            <md-tab md-label="Roles" :to="{ name: 'records-roles', params: { recordName } }">
                <router-view></router-view>
            </md-tab>
        </md-tabs>
    </div>
</template>
<script src="./AuthRecords.ts"></script>
<style src="./AuthRecords.css"></style>
