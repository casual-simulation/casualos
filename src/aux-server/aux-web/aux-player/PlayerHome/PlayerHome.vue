<template>
    <div>
        <game-view
            v-if="!isLoading"
            class="game-view"
            :debug="debug"
            containerId="app-game-container"
        >
            <div class="ui-container"></div>
        </game-view>
        <div v-if="showBios">Show BIOS</div>
        <md-dialog :md-active.sync="showBios">
            <md-dialog-title>BIOS</md-dialog-title>
            <md-dialog-content>
                <md-field>
                    <label for="biosOption">BIOS Option</label>
                    <md-select v-model="biosSelection" name="biosOption" id="biosOption">
                        <md-option v-for="option in biosOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field>
                <md-field v-if="recordsOptions.length > 0">
                    <label for="recordOption">Record</label>
                    <md-select v-model="recordSelection" name="recordOption" id="recordOption">
                        <md-option value="null">My Studio</md-option>
                        <md-option v-for="option in recordsOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field>
                <md-field v-if="instOptions.length > 0">
                    <label for="instOption">Inst</label>
                    <md-select v-model="instSelection" name="instOption" id="instOption">
                        <md-option value="new-inst">New Inst</md-option>
                        <md-option v-for="option in instOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="executeBiosOption(biosSelection, recordSelection, instSelection)"
                    >Continue</md-button
                >
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./PlayerHome.ts"></script>
<style src="./PlayerHome.css"></style>
