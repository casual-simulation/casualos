<template>
    <div>
        <game-view
            v-if="!isLoading"
            class="game-view"
            :debug="debug"
            containerId="app-game-container"
        >
            <div class="ui-container"></div>
        </game-view>
    </div>
</template>
<script src="./PlayerHome.ts"></script>
<style src="./PlayerHome.css"></style>
