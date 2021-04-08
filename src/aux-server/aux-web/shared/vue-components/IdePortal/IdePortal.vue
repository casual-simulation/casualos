<template>
    <div v-if="hasPortal" class="ide-portal" v-on:keydown.stop v-on:keyup.stop>
        <hotkey :keys="['ctrl', 'shift', 'f']" @triggered="showSearch()" />
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <div class="items-list">
                    <div class="items-list-header">
                        <span
                            @click="showTags()"
                            class="items-list-header-option"
                            :class="{ active: isViewingTags }"
                            >Tags</span
                        >
                        <span
                            @click="showSearch()"
                            class="items-list-header-option"
                            :class="{ active: !isViewingTags }"
                            >Search</span
                        >
                    </div>
                    <div class="items-list-items" v-show="isViewingTags">
                        <div
                            v-for="item in items"
                            :key="item.key"
                            @click="selectItem(item)"
                            class="item"
                            :class="{ selected: selectedItem && item.key === selectedItem.key }"
                        >
                            <bot-tag
                                :tag="item.name"
                                :isScript="item.isScript"
                                :isFormula="item.isFormula"
                                :prefix="item.prefix"
                                :light="true"
                            >
                            </bot-tag>
                        </div>
                    </div>
                    <div class="search-container" v-show="!isViewingTags">
                        <div class="search-input-container">
                            <input
                                ref="searchInput"
                                class="search-input"
                                placeholder="Search"
                                @input="updateSearch"
                            />
                        </div>
                        <div class="items-list-items">
                            <div
                                v-for="item in searchItems"
                                :key="item.key"
                                class="item"
                                @click="selectSearchItem(item)"
                            >
                                <bot-tag
                                    :tag="item.tag"
                                    :isScript="item.isScript"
                                    :isFormula="item.isFormula"
                                    :prefix="item.prefix"
                                ></bot-tag>
                                <div class="search-item-hint">{{ item.text }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="portal-content" v-if="currentBot && currentTag">
                    <tag-value-editor
                        ref="multilineEditor"
                        :bot="currentBot"
                        :tag="currentTag"
                        :space="currentSpace"
                        :showDesktopEditor="true"
                        :showResize="false"
                    ></tag-value-editor>
                </div>
                <md-button v-if="showButton" class="md-fab exit-portal" @click="exitPortal()">
                    <md-icon>{{ finalButtonIcon }}</md-icon>
                    <md-tooltip>{{ finalButtonHint }}</md-tooltip>
                </md-button>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./IdePortal.ts"></script>
<style src="./IdePortal.css" scoped></style>
