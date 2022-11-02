<template>
    <span
        @click="emitClick()"
        class="tag bot-tag"
        :class="{ clonable: allowCloning, light: light }"
    >
        <span v-if="prefix && prefix !== '#'">
            <span :class="{ 'at-symbol': isScript, 'custom-prefix': !isScript }">
                {{ prefix }} </span
            ><span class="tag-name">
                <highlighted-text
                    v-if="highlight"
                    :text="tag"
                    :startIndex="highlight.startIndex"
                    :endIndex="highlight.endIndex"
                />
                <template v-else>{{ tag }}</template>
            </span>
        </span>
        <span v-else>
            <span class="hashtag">#</span
            ><span class="tag-name">
                <highlighted-text
                    v-if="highlight"
                    :text="tag"
                    :startIndex="highlight.startIndex"
                    :endIndex="highlight.endIndex"
                />
                <template v-else>{{ tag }}</template>
            </span>
        </span>
    </span>
</template>
<script src="./BotTag.ts"></script>
<style src="./BotTag.css"></style>
