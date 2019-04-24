<template>
    <div class="file-search" :class="{ open: isOpen }">
        <md-field md-inline v-if="isOpen">
            <label>Search</label>
            <md-input v-model="search"></md-input>
            <!-- <span class="md-suffix num-files" @click="toggleOpen()">1</span> -->
        </md-field>
        <md-button v-if="isOpen" class="md-icon-button num-files" @click="toggleOpen()">
            {{ (values ? values.length : 0) || 0 }}
        </md-button>
        <md-button v-if="!isOpen" class="search-button md-icon-button" @click="toggleOpen()">
            <md-icon>search</md-icon>
        </md-button>
    </div>
</template>
<script src="./FileSearch.ts"></script>
<style src="./FileSearch.css" scoped></style>
