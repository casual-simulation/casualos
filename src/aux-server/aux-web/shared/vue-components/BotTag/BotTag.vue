<template>
    <span class="tag bot-tag" :class="{ clonable: allowCloning }">
        <span v-if="!isScript">
            <span class="hashtag">#</span><span class="tag-name">{{ tag }}</span
            ><span v-if="isFormula" class="equals-sign">=</span>
        </span>
        <span v-else>
            <span class="at-symbol">@</span><span class="tag-name">{{ tag }}</span>
        </span>
    </span>
</template>
<script src="./BotTag.ts"></script>
<style src="./BotTag.css"></style>
