<template>
    <div class="bot-library-container">
        <div class="bots-catalogue">
            <div v-for="bot in bots" :key="bot.id" class="bot-item" @click="selectBot(bot)">
                <div class="bot-name">{{ bot.tags.system }}</div>
                <div class="bot-id">{{ bot.id.split('-')[0] }}</div>
            </div>
        </div>
        <div class="bots-catalogue-meta">
            <p>Count: {{ botCount }}</p>
        </div>
        <div class="bot-search-section">
            <md-field>
                <label>Search by ID or System</label>
                <md-input
                    class="bot-search-input"
                    v-model="searchQuery"
                    placeholder="Search Bots..."
                ></md-input>
            </md-field>
        </div>
    </div>
</template>

<style>
.bot-library-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
}
.bots-catalogue {
    flex-grow: 55;
    overflow-y: auto;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    gap: 0 15px;
    max-height: 600px;
}
.bot-item {
    padding: 8px 16px;
    border-left: 3px solid #a1a1a1;
    box-shadow: inset 0 0 8px #7b7b7b4a, 0 0 5px #21212163;
    cursor: pointer;
    height: fit-content;
    width: fit-content;
}
.bot-item:hover {
    background-color: #f5f5f5;
}
.bot-name {
    font-weight: bold;
}
.bot-id {
    font-size: 0.9em;
    color: #666;
}
.bot-search-section {
    flex-grow: 1;
    margin-top: 10px;
    display: flex;
}
</style>

<script src="./BotLibrary.ts"></script>
