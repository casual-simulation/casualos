<template>
    <div id="app" class="app-container">
        <md-app class="app">
            <md-app-toolbar>
                <router-link :to="{ name: 'home' }" class="title-link md-title" style="flex: 1">
                    <img
                        v-if="logoUrl"
                        :src="logoUrl"
                        :title="displayName || title"
                        :alt="displayName || title"
                        class="title-img"
                    />
                    <strong v-else>{{ displayName || title }}</strong>
                </router-link>
                <md-button v-if="showLogout" @click="logout">Sign Out</md-button>
            </md-app-toolbar>
            <md-app-drawer v-if="showSidebar" md-permanent="clipped">
                <md-list>
                    <md-list-item :to="{ name: 'home' }">
                        <md-icon>person</md-icon>
                        <span class="md-list-item-text">Account</span>
                    </md-list-item>
                    <md-list-item :to="{ name: 'granted-entitlements' }">
                        <md-icon>box</md-icon>
                        <span class="md-list-item-text">Granted Entitlements</span>
                    </md-list-item>
                    <md-list-item
                        md-expand
                        :md-expanded.sync="showRecords"
                        @click="onExpandRecords"
                    >
                        <md-icon>description</md-icon>
                        <span class="md-list-item-text">User Studio</span>

                        <template v-slot:md-expand>
                            <md-list>
                                <md-list-item
                                    v-for="record in records"
                                    :key="record.name"
                                    class="md-inset record-item"
                                    :to="{
                                        name: 'records-insts',
                                        params: { recordName: record.name },
                                    }"
                                >
                                    <md-icon>description</md-icon>
                                    <span v-if="record.name !== userId">{{ record.label }}</span>
                                    <span v-else>User Record ({{ record.name }})</span>
                                </md-list-item>
                                <md-list-item v-if="loadingRecords" class="md-inset">
                                    <md-progress-spinner
                                        md-mode="indeterminate"
                                        :md-diameter="20"
                                        :md-stroke="2"
                                        >Loading...</md-progress-spinner
                                    >
                                </md-list-item>
                                <md-list-item
                                    v-else-if="!records || records.length === 0"
                                    class="md-inset"
                                >
                                    <strong class="md-list-item-text">No Records</strong>
                                </md-list-item>
                                <md-button class="md-raised md-primary" @click="startCreateRecord()"
                                    >Add Record</md-button
                                >
                            </md-list>
                        </template>
                    </md-list-item>
                    <md-list-item
                        v-for="studio of studios"
                        :key="studio.studioId"
                        @click="onExpandStudio(studio)"
                        md-expand
                        :md-expanded.sync="studio.open"
                    >
                        <md-icon>description</md-icon>
                        <span class="md-list-item-text">{{ studio.displayName }}</span>

                        <template v-slot:md-expand>
                            <md-list>
                                <md-list-item
                                    class="md-inset"
                                    v-if="studio.comId"
                                    :to="{ name: 'home', query: { comId: studio.comId } }"
                                    target="_blank"
                                >
                                    <md-icon>open_in_new</md-icon>
                                    <span class="md-list-item-text">Go to site</span>
                                </md-list-item>
                                <md-list-item
                                    class="md-inset"
                                    v-if="studio.role === 'admin'"
                                    :to="{
                                        name: 'studio',
                                        params: {
                                            studioId: studio.studioId,
                                            studioName: studio.displayName,
                                        },
                                    }"
                                >
                                    <md-icon>settings</md-icon>
                                    <span class="md-list-item-text">Settings</span>
                                </md-list-item>
                                <md-list-item
                                    v-for="record in studio.records"
                                    :key="record.name"
                                    class="md-inset record-item"
                                    :to="{
                                        name: 'records-data',
                                        params: { recordName: record.name },
                                    }"
                                >
                                    <md-icon>description</md-icon>
                                    <span class="md-list-item-text">
                                        <span v-if="record.name !== studio.studioId">
                                            {{ record.label }}
                                        </span>
                                        <span v-else> Studio Record ({{ record.name }}) </span>
                                    </span>
                                </md-list-item>
                                <md-list-item v-if="studio.loading" class="md-inset">
                                    <md-progress-spinner
                                        md-mode="indeterminate"
                                        :md-diameter="20"
                                        :md-stroke="2"
                                        >Loading...</md-progress-spinner
                                    >
                                </md-list-item>
                                <md-list-item
                                    v-else-if="!studio.records || studio.records.length === 0"
                                    class="md-inset"
                                >
                                    <strong class="md-list-item-text">No Records</strong>
                                </md-list-item>
                                <md-button
                                    class="md-raised md-primary"
                                    @click="startCreateRecord(studio.studioId)"
                                    >Add Record</md-button
                                >
                            </md-list>
                        </template>
                    </md-list-item>
                    <md-list-item>
                        <md-button
                            v-if="allowCreateStudio"
                            class="md-raised md-primary"
                            @click="startCreateStudio()"
                            >Add Studio</md-button
                        >
                    </md-list-item>
                </md-list>
            </md-app-drawer>
            <md-app-content>
                <router-view></router-view>
            </md-app-content>
        </md-app>

        <md-dialog :md-active.sync="showCreateStudio">
            <md-dialog-title>Add Studio</md-dialog-title>

            <md-dialog-content>
                <form @submit.prevent="createStudio()">
                    <md-field :class="studioNameFieldClass">
                        <label>Studio Name</label>
                        <md-input v-model="studioName" required></md-input>
                        <field-errors :field="'displayName'" :errors="errors" />
                    </md-field>
                    <field-errors :field="null" :errors="errors" />
                </form>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button
                    type="submit"
                    class="md-primary"
                    :disabled="processing"
                    @click="createStudio()"
                >
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    ><span v-else>Create</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog :md-active.sync="showCreateRecord">
            <md-dialog-title>Add Record</md-dialog-title>
            <md-dialog-content>
                <form @submit.prevent="createRecord()">
                    <md-field :class="recordNameFieldClass">
                        <label>Record Name</label>
                        <md-input v-model="recordName" required ref="recordInput"></md-input>
                        <field-errors :field="'recordName'" :errors="errors" />
                    </md-field>
                    <md-field>
                        <label>Studio</label>
                        <md-select v-model="createRecordStudioId">
                            <md-option :value="''"> User Studio </md-option>
                            <md-option
                                v-for="studio of studios"
                                :key="studio.studioId"
                                :value="studio.studioId"
                            >
                                {{ studio.displayName }}
                            </md-option>
                        </md-select>
                    </md-field>
                    <field-errors :field="null" :errors="errors" />
                </form>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button
                    type="submit"
                    class="md-primary"
                    :disabled="processing"
                    @click="createRecord()"
                >
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    ><span v-else>Create</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <footer>
            <ul class="footer-links">
                <li><a href="/privacy-policy">Privacy Policy</a></li>
                <li><a href="/code-of-conduct">Code of Conduct</a></li>
                <li><a href="/terms">Terms of Service</a></li>
                <li v-if="comId">
                    <a href="/">Back to {{ hostname }}</a>
                </li>
                <li v-if="usePrivoLogin">
                    <a
                        style="display: inline-block; width: 140px; height: 70px"
                        target="_blank"
                        href="https://cert.privo.com/#/companies/casualsimulation"
                        ><img
                            src="https://privohub.privo.com/files/images/PRIVO_Cert/COPPA.png"
                            alt="COPPA Safe Harbor Certification - Kids Privacy Assured by PRIVO"
                    /></a>
                </li>
            </ul>
        </footer>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
<style src="./AuthAppScoped.css" scoped></style>
