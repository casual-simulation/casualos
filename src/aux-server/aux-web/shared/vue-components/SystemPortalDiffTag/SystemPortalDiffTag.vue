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
            <diff-status :status="status"></diff-status>
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
                        v-if="modifiedBot && status !== 'none'"
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
