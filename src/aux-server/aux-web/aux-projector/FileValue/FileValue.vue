<template>
    <input 
        @input="valueChanged(file, tag, $event.target.value)" 
        @focus="focus()" 
        @blur="blur()" 
        :value="value" 
        class="value-input" 
        :disabled="readOnly"
        :class="[{ focused: (isFocused), formula: (isFormula && showFormulaWhenFocused) }, tag]"
        autocapitalize="none"
        autocorrect="off">
</template>
<script src="./FileValue.ts"></script>
<style src="./FileValue.css"></style>