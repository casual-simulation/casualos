<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen">
            <md-card-content>
              Welcome Home {{user.name}}!
              <h4>Files</h4>
              <ul>
                <li v-for="file in files" :key="file">
                  {{file}}
                </li>
              </ul>

              <h4>Commits</h4>
              <ul>
                <li v-for="commit in commits" :key="commit.oid">
                  {{commit.message}}
                </li>
              </ul>

              <p>
                {{status}}
              </p>
            </md-card-content>
            <md-card-actions>
              <md-button @click="close()">Close</md-button>
            </md-card-actions>
          </md-card>
        </div>
      </game-view>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>