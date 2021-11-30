<template>
    <span class="tag bot-tag" :class="{ clonable: allowCloning, light: light }">
        <span v-if="isFormula">
            <span class="dna-symbol">🧬</span><span class="tag-name">{{ tag }}</span>
        </span>
        <span v-else-if="isScript">
            <span class="at-symbol">@</span><span class="tag-name">{{ tag }}</span>
        </span>
        <span v-else-if="isLink">
            <span class="link-symbol">🔗</span><span class="tag-name">{{ tag }}</span>
        </span>
        <span v-else-if="prefix">
            <span class="custom-prefix">{{ prefix }}</span
            ><span class="tag-name">{{ tag }}</span>
        </span>
        <span v-else>
            <span class="hashtag">#</span><span class="tag-name">{{ tag }}</span>
        </span>
    </span>
</template>
<script src="./BotTag.ts"></script>
<style src="./BotTag.css"></style>
