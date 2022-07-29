<template>
    <div
        class="tags-list-tag"
        :class="{
            selected: selected,
        }"
        @click="onClick"
    >
        <div class="tags-list-tag-header">
            <bot-tag :tag="tag.name" :prefix="tag.prefix" :allowCloning="false"></bot-tag>
            <span v-show="!!tag.space" class="tag-space">{{ tag.space }}</span>
            <md-button
                v-if="showCloseButton"
                class="md-dense md-icon-button remove-tag"
                @click="onClose"
            >
                <md-icon>remove</md-icon>
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
                {{ getBotValue(originalBot) }}
            </span>
            <div v-else :class="[status]">
                <div class="original-bot-value">
                    <bot-value
                        v-if="originalBot"
                        ref="valueEditor"
                        :bot="originalBot"
                        :tag="tag.name"
                        :space="tag.space"
                        :alwaysShowRealValue="true"
                        :showSpace="false"
                        @focusChanged="focusChanged"
                    ></bot-value>
                </div>

                <div class="modified-bot-value">
                    <bot-value
                        v-if="modifiedBot"
                        :bot="modifiedBot"
                        :tag="tag.name"
                        :space="tag.space"
                        :alwaysShowRealValue="true"
                        :showSpace="false"
                        @focusChanged="focusChanged"
                    >
                    </bot-value>
                </div>
            </div>
        </div>
    </div>
</template>
<script src="./SystemPortalDiffTag.ts"></script>
<style src="./SystemPortalDiffTag.css" scoped></style>
<style src="./SystemPortalDiffTagGlobals.css"></style>
