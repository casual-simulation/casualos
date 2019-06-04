<template>
    <div class="file-search" :class="{ open: isOpen }">
        <md-field md-inline>
            <label>{{ placeholder }}</label>
            <md-input v-model="search"></md-input>
            <!-- <span class="md-suffix num-files" @click="toggleOpen()">1</span> -->
        </md-field>
        <md-button v-show="search" class="md-icon-button" @click="executeSearch()">
            <md-icon>play_arrow</md-icon>
            <md-tooltip md-direction="bottom">Run Script</md-tooltip>
        </md-button>

        <div v-if="placeholder === 'Search / Run'" class="search-count">
            <md-button class="md-icon-button num-files" @click="toggleOpen()">
                <div ref="fileQueue">
                    <div v-if="filesMode && simulation" class="toolbar-layout">
                        <mini-file
                            v-for="(file, index) in simulation.files"
                            :key="index"
                            :file="file"
                            :selected="simulation.selectedRecentFile === file"
                            :large="index === 0"
                            ref="mini"
                            :isSearch="true"
                        ></mini-file>
                    </div>
                </div>
            </md-button>
        </div>
        <div v-else class="search-count">
            <md-button class="md-icon-button num-files" @click="toggleOpen()">
                <cubeSearch-icon></cubeSearch-icon>
            </md-button>

            <div class="testThis">
                {{ filesLength || 0 }}
            </div>
        </div>
    </div>
</template>
<script src="./FileSearch.ts"></script>
<style src="./FileSearch.css" scoped></style>
