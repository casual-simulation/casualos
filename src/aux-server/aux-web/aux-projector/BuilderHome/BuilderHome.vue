<template>
    <div>
        <md-card
            ref="card"
            class="info-card"
            :class="{ maximized: this.setLargeSheet }"
            v-if="!isLoading"
        >
            <md-card-content>
                <bot-table
                    ref="table"
                    class="bots-table"
                    @closeWindow="toggleOpen()"
                    @tagFocusChanged="tagFocusChanged"
                    :bots="bots"
                    :setLargeSheet="setLargeSheet"
                    :allowChangingSheetSize="false"
                    :updateTime="updateTime"
                    :selectionMode="selectionMode"
                    :diffSelected="isDiff"
                    :showAddTagButton="false"
                    :dimension="dimension"
                ></bot-table>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./BuilderHome.ts"></script>
<style src="./BuilderHome.css"></style>
