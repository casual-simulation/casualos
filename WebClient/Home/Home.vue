<!-- App.vue -->
<template>
  <div>
      <md-card>
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
      </md-card>
      <game-view class="game-view"></game-view>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>