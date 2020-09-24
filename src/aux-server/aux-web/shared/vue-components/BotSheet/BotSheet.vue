<template>
    <div v-if="hasPortal" class="bot-sheet">
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
                ></bot-table>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./BotSheet.ts"></script>
<style src="./BotSheet.css" scoped></style>
