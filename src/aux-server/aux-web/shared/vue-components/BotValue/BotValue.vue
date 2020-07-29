<template>
    <input
        @input="valueChanged(bot, tag, $event.target.value)"
        @focus="focus()"
        @blur="blur()"
        :value="value"
        class="value-input"
        :disabled="readOnly"
        :class="[
            {
                formula: isFormula && showFormulaWhenFocused,
                script: isScript,
            },
            tag,
        ]"
        autocapitalize="none"
        autocorrect="off"
        @keydown.enter="triggerNewTag()"
    />
</template>
<script src="./BotValue.ts"></script>
<style src="./BotValue.css"></style>
