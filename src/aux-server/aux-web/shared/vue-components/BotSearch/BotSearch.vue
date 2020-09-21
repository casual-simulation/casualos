<template>
    <div
        class="bot-search"
        :class="{ open: isOpen }"
        v-shortkey.once="['ctrl', 'f']"
        @shortkey="startSearch()"
    >
        <md-field md-inline>
            <label>{{ placeholder }}</label>
            <md-input class="search-input" ref="searchInput" v-model="search"></md-input>
        </md-field>
        <md-button v-show="search" class="md-icon-button" @click="executeSearch()">
            <md-icon>play_arrow</md-icon>
            <md-tooltip md-direction="bottom">Run Script</md-tooltip>
        </md-button>

        <div v-if="placeholder === 'Search / Run'" class="search-count">
            <!-- Toggle open is handled by the MiniBotClickOperation -->
            <md-button class="md-icon-button num-bots">
                <div ref="botQueue">
                    <div v-if="recentBot" class="toolbar-layout">
                        <mini-bot :bot="recentBot" ref="mini"></mini-bot>
                    </div>
                </div>
            </md-button>
        </div>
        <div v-else class="search-count">
            <md-button class="md-icon-button num-bots" @click="toggleOpen()">
                <cubeSearch-icon></cubeSearch-icon>
            </md-button>

            <div class="testThis">
                {{ botsLength || 0 }}
            </div>
        </div>
    </div>
</template>
<script src="./BotSearch.ts"></script>
<style src="./BotSearch.css" scoped></style>
