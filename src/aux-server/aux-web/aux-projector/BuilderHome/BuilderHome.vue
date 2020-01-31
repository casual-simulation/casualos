<template>
    <div>
        <md-card ref="card" class="info-card maximized" v-if="!isLoading">
            <md-card-content>
                <bot-table
                    ref="table"
                    class="bots-table"
                    @closeWindow="toggleOpen()"
                    @tagFocusChanged="tagFocusChanged"
                    @exitSheet="openInPlayer()"
                    @goToTag="goToTag"
                    :bots="bots"
                    :updateTime="updateTime"
                    :diffSelected="isDiff"
                    :dimension="dimension"
                    :showExitSheet="false"
                ></bot-table>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./BuilderHome.ts"></script>
<style src="./BuilderHome.css"></style>
