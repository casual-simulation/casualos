<template>
    <div
        v-if="hasPortal"
        class="bot-sheet"
        :class="{ 'system-portal-sheet': hasSystemPortal }"
        v-on:keydown.stop
        v-on:keyup.stop
    >
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <bot-table
                    ref="table"
                    class="bots-table"
                    @tagFocusChanged="tagFocusChanged"
                    @exitSheet="exitSheet()"
                    @goToTag="goToTag"
                    @botIDClick="botIDClick"
                    @botClick="botClick"
                    :bots="bots"
                    :diffSelected="isDiff"
                    :dimension="dimension"
                    :showNewBot="showNewBot"
                    :showExitSheet="showButton"
                    :exitSheetIcon="buttonIcon"
                    :exitSheetHint="buttonHint"
                    :allowedTags="allowedTags"
                    :extraTags="addedTags"
                    @hook:mounted="onTableMounted"
                ></bot-table>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./BotSheet.ts"></script>
<style src="./BotSheet.css" scoped></style>
