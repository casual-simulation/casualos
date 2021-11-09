<template>
    <div
        class="tags-list-tag"
        :class="{
            selected: selected,
        }"
        @click="onClick"
    >
        <div class="tags-list-tag-header">
            <bot-tag
                :tag="tag.name"
                :isScript="tag.isScript"
                :isFormula="tag.isFormula"
                :allowCloning="false"
            ></bot-tag>
            <span v-show="!!tag.space" class="tag-space">{{ tag.space }}</span>
            <md-button
                v-show="showCloseButton"
                class="md-dense md-icon-button remove-tag"
                @click="onClose"
            >
                <md-icon>close</md-icon>
                <md-tooltip md-delay="1000" md-direction="top">Remove #{{ tag.name }}</md-tooltip>
            </md-button>
        </div>
        <div class="tags-list-tag-value">
            <bot-value
                ref="valueEditor"
                :bot="bot"
                :tag="tag.name"
                :space="tag.space"
                :alwaysShowRealValue="true"
                :showSpace="false"
                @focusChanged="focusChanged"
            ></bot-value>
        </div>
    </div>
</template>
<script src="./SystemPortalTag.ts"></script>
<style src="./SystemPortalTag.css" scoped></style>
