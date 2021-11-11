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
                v-if="showCloseButton"
                class="md-dense md-icon-button remove-tag"
                @click="onClose"
            >
                <md-icon>close</md-icon>
                <md-tooltip md-delay="1000" md-direction="top">Unpin #{{ tag.name }}</md-tooltip>
            </md-button>
            <md-button
                v-else-if="showPinButton"
                class="md-dense md-icon-button pin-tag"
                @click="onPin"
            >
                <md-icon>push_pin</md-icon>
                <md-tooltip md-delay="1000" md-direction="top">Pin #{{ tag.name }}</md-tooltip>
            </md-button>
        </div>
        <div
            class="tags-list-tag-value"
            :class="{ 'read-only': isReadOnly, id: tag.name === 'id' }"
        >
            <!-- Read Only Tags -->
            <span v-if="isReadOnly">
                {{ getBotValue() }}
            </span>
            <bot-value
                v-else
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
