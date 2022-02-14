<template>
    <span class="tag bot-tag" :class="{ clonable: allowCloning, light: light }">
        <span v-if="prefix">
            <span :class="{ 'at-symbol': isScript, 'custom-prefix': !isScript }">{{ prefix }}</span
            ><span class="tag-name">{{ tag }}</span>
        </span>
        <span v-else>
            <span class="hashtag">#</span><span class="tag-name">{{ tag }}</span>
        </span>
    </span>
</template>
<script src="./BotTag.ts"></script>
<style src="./BotTag.css"></style>
