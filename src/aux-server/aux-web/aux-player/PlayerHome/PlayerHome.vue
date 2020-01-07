<template>
    <div>
        <game-view v-if="!isLoading" class="game-view" :debug="debug" :dimension="dimension">
            <div class="ui-container"></div>
        </game-view>
    </div>
</template>
<script src="./PlayerHome.ts"></script>
<style src="./PlayerHome.css"></style>
