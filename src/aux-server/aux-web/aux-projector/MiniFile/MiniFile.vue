<template>
    <div class="mini-file" :class="{ active: selected }" @click="click()">
        <div v-if="!isSearch" class="mini-file-cube" :class="{ large: large }">
            <div class="mini-file-text" v-show="label" :style="{ color: labelColor }">
                {{ label }}
            </div>
            <img class="mini-file-img" :src="image" draggable="false" />
            <div class="mini-file-tags">
                <tag-color v-for="tag in tags" :key="tag" :tag="tag"></tag-color>
            </div>
        </div>
        <div v-else class="mini-file-search">
            <img class="mini-file-img" :src="image" draggable="false" />
        </div>
    </div>
</template>
<script src="./MiniFile.ts"></script>
<style src="./MiniFile.css"></style>
