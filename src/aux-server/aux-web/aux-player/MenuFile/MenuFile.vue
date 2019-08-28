<template>
    <md-list-item
        class="menu-file"
        :class="{ active: selected }"
        :style="{ 'background-color': backgroundColor }"
        @click="click()"
    >
        <div class="menu-file-text" v-show="label" :style="{ color: labelColor }">
            {{ label }}
        </div>
    </md-list-item>
</template>
<script src="./MenuFile.ts"></script>
<style src="./MenuFile.css"></style>
