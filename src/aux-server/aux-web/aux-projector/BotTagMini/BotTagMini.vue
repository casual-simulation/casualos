<template>
    <span class="tag bot-tag-mini clonable">
        <mini-bot
            :bot="bots"
            :selected="false"
            :large="false"
            ref="mini"
            :isSearch="true"
            class="bot-tag-mini"
            :createMod="createMod"
            @click="click()"
        ></mini-bot>
    </span>
</template>
<script src="./BotTagMini.ts"></script>
<style src="./BotTagMini.css"></style>
