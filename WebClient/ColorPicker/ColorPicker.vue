<template>
    <div class="color-picker" :style="colorPickerStyle">
        <chrome-color-picker v-show="colorPickerVisible" v-model="colors" @input="onColorPickerInput" :disableAlpha="true"/>
    </div>
</template>
<script src="./ColorPicker.ts"></script>
<style src="./ColorPicker.css"></style>