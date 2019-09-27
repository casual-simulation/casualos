<template>
    <tr class="bot-row" v-if="bot">
        <td class="bot-close">
            <md-button class="md-icon-button md-dense" @click="toggleFile(bot)">
                <md-icon>remove</md-icon>
                <md-tooltip md-delay="1000" md-direction="top">Unselect Item</md-tooltip>
            </md-button>
        </td>
        <td class="bot-id">{{ bot.id.substring(0, 3) }}</td>
        <td v-for="tag in tags" :key="tag">
            <bot-value
                :readOnly="readOnly"
                :bot="bot"
                :tag="tag"
                :updateTime="updateTime"
                :showFormulaWhenFocused="showFormulasWhenFocused"
                @tagChanged="onTagChanged"
                @focusChanged="tagFocusChanged(bot, tag, $event)"
            ></bot-value>
        </td>
    </tr>
</template>
<script src="./FileRow.ts"></script>
<style src="./FileRow.css"></style>
