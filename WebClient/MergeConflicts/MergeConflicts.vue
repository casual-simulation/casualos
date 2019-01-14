<template>
    <div>
        <h1>Fixing conflicts one at time!</h1>
        <div v-for="file in files" :key="file.id">
            <h2>{{file.id}}</h2>
            <file-table :files="[file.first, file.second]" :extraTags="file.tags" :readOnly="true"/>
            <div v-for="(conflict, index) in file.conflicts" :key="index">
                <file-tag :tag="conflictName(conflict)" />
                <md-list>
                    <md-list-item>
                        <span class="md-list-item-text">Take Ours</span>
                        <md-button class="md-list-action" @click="takeValue(file, conflict, conflict.conflict[first])">{{conflict.conflict[first]}}</md-button>
                    </md-list-item>
                    <md-list-item>
                        <span class="md-list-item-text">Take Theirs</span>
                        <md-button class="md-list-action" @click="takeValue(file, conflict, conflict.conflict[second])">{{conflict.conflict[second]}}</md-button>
                    </md-list-item>
                </md-list>
            </div>
        </div>
        <div v-if="files.length <= 0">
            <md-button @click="finish()">Finish</md-button>
        </div>
    </div>
</template>
<script src="./MergeConflicts.ts"></script>
<style src="./MergeConflicts.css"></style>