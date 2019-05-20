<template>
    <div class="file-search" :class="{ open: isOpen }">
        <md-field md-inline>
            <label>{{ placeholder }}</label>
            <md-input v-model="search"></md-input>
            <!-- <span class="md-suffix num-files" @click="toggleOpen()">1</span> -->
        </md-field>
        <md-button class="md-icon-button num-files" @click="toggleOpen()">
            {{ files.length || 0 }}
        </md-button>
    </div>
</template>
<script src="./FileSearch.ts"></script>
<style src="./FileSearch.css" scoped></style>
