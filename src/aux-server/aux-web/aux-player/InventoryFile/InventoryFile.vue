<!-- App.vue -->
<template>
    <div class="inventory-file" :class="{ active: selected }" @click="click()">
        <div class="inventory-file-cube">
            <div class="inventory-file-text" v-show="label" :style="{ color: labelColor }">
                {{ label }}
            </div>
            <img
                class="inventory-file-img"
                :src="image"
                draggable="false"
                :style="{ display: showImage }"
            />
        </div>
    </div>
</template>
<script src="./InventoryFile.ts"></script>
<style src="./InventoryFile.css"></style>
