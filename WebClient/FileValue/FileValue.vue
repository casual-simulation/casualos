<template>
    <input 
        @input="valueChanged(file, tag, $event.target.value)" 
        @focus="focus()" 
        @blur="blur()" 
        :value="value" 
        class="value-input" 
        :class="[{ focused: isFocused, formula: isFormula }, tag]"
        :style="{ 'background-color': backgroundColor, 'color': color }">
</template>
<script src="./FileValue.ts"></script>
<style src="./FileValue.css"></style>