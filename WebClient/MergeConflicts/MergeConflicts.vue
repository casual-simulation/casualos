<template>
    <div>
        <h1>Fixing conflicts one at time!</h1>
        <div v-for="file in files" :key="file.id">
            <h2>{{file.id}}</h2>
            <div v-for="(conflict, index) in file.conflicts" :key="index">
                <h3>{{conflict.path.join('.')}}</h3>
                <ul>
                    <li><md-button @click="takeValue(file, conflict, conflict.conflict[first])">{{conflict.conflict[first]}}</md-button></li>
                    <li><md-button @click="takeValue(file, conflict, conflict.conflict[second])">{{conflict.conflict[second]}}</md-button></li>
                </ul>
            </div>
        </div>
        <div v-if="files.length <= 0">
            <md-button @click="finish()">Finish</md-button>
        </div>
    </div>
</template>
<script src="./MergeConflicts.ts"></script>
<style src="./MergeConflicts.css"></style>