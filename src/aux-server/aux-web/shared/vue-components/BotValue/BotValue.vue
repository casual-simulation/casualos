<template>
    <div class="value-input-container">
        <textarea
            ref="textarea"
            @input="valueChanged(bot, tag, $event.target.value)"
            @focus="onFocus()"
            @blur="onBlur()"
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
            @keydown.enter.prevent="triggerNewTag()"
        />
        <md-button v-if="!!space" class="space-indicator md-dense">
            {{ spaceAbbreviation }}
            <md-tooltip>{{ space }}</md-tooltip>
        </md-button>
    </div>
</template>
<script src="./BotValue.ts"></script>
<style src="./BotValue.css"></style>
