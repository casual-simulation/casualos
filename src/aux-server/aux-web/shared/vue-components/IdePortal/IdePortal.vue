<template>
    <div v-if="hasPortal" class="ide-portal">
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <div class="items-list">
                    <div class="items-list-header">Tags</div>
                    <div class="items-list-items">
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
