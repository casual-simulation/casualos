<template>
    <div class="merge-conflicts">
        <h1>Fixing conflicts one at time!</h1>
        <div v-for="file in files" :key="file.id">
            <h2>{{file.id}}</h2>

            <md-list>
                <md-list-item v-for="(conflict, index) in file.conflicts" :key="index">
                    <md-field>
                        <label class="md-list-item-text" for="conflict">
                            <file-tag :tag="conflictName(conflict)" />
                        </label>
                        <md-select name="conflict" @md-selected="takeValue(file, conflict, $event)">
                            <md-option :value="true">Yours: {{conflict.conflict[first]}}</md-option>
                            <md-option :value="false">Theirs: {{conflict.conflict[second]}}</md-option>
                        </md-select>
                    </md-field>
                </md-list-item>
            </md-list>
        </div>
        <div v-if="files.length <= 0">
            <md-button @click="finish()">Finish</md-button>
        </div>
    </div>
</template>
<script src="./MergeConflicts.ts"></script>
<style src="./MergeConflicts.css"></style>