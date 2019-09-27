<template>
    <span class="tag bot-tag-mini clonable">
        <mini-bot
            :bot="bots"
            :selected="false"
            :large="false"
            ref="mini"
            :isSearch="true"
            class="bot-tag-mini"
        ></mini-bot>
    </span>
</template>
<script src="./FileTagMini.ts"></script>
<style src="./FileTagMini.css"></style>
