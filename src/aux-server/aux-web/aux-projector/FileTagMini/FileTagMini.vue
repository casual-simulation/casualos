<template>
    <span class="tag file-tag-mini clonable">
        <mini-file
            :file="files"
            :selected="false"
            :large="false"
            ref="mini"
            :isSearch="true"
            class="file-tag-mini"
        ></mini-file>
    </span>
</template>
<script src="./FileTagMini.ts"></script>
<style src="./FileTagMini.css"></style>
