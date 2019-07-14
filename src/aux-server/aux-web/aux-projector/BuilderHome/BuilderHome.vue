<template>
    <div>
        <game-view
            class="game-view"
            @onContextMenu="handleContextMenu"
            @onContextMenuHide="hideContextMenu"
            :debug="debug"
            :channelId="channelId"
        >
            <div class="ui-container" v-shortkey.once="['ctrl', 'f']" @shortkey="startSearch()">
                <md-card
                    ref="card"
                    class="info-card"
                    v-if="isOpen && filesMode"
                    v-bind:style="getSheetStyle()"
                >
                    <md-card-content>
                        <div>
                            <file-table
                                ref="table"
                                class="files-table"
                                @closeWindow="toggleOpen()"
                                @tagFocusChanged="tagFocusChanged"
                                :files="files"
                                :searchResult="searchResult"
                                :isSearch="isSearch"
                                :updateTime="updateTime"
                                :selectionMode="selectionMode"
                                :diffSelected="isDiff"
                                :showAddTagButton="false"
                            ></file-table>
                        </div>
                    </md-card-content>
                </md-card>
            </div>
        </game-view>

        <div class="context-menu" :style="contextMenuStyle">
            <md-menu v-show="contextMenuEvent" :md-active.sync="contextMenuVisible">
                <md-menu-content>
                    <div v-if="contextMenuEvent">
                        <md-menu-item
                            v-for="item of contextMenuEvent.actions"
                            v-bind:key="item.label"
                            @click="item.onClick"
                        >
                            {{ item.label }}
                        </md-menu-item>
                    </div>
                    <div v-else>
                        <!-- render nothing you fools -->
                    </div>
                </md-menu-content>
            </md-menu>
        </div>
    </div>
</template>
<script src="./BuilderHome.ts"></script>
<style src="./BuilderHome.css"></style>
