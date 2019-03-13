<template>
  <div class="tree-view-wrapper">
    <tree-view-item
      class="tree-view-item-root"
      :data="parsedData"
      :max-depth="allOptions.maxDepth"
      :current-depth="0"
      :modifiable="allOptions.modifiable"
      :link="allOptions.link"
      :limit-render-depth="allOptions.limitRenderDepth"
      @change-data="onChangeData"
    ></tree-view-item>
  </div>
</template>

<script src="./TreeView.ts"></script>

<style scoped>

/* Find the first nested node and override the indentation */
.tree-view-item-root > .tree-view-item-leaf > .tree-view-item {
  margin-left: 0 !important;
}

/* Root node should not be indented */
.tree-view-item-root {
  margin-left: 0 !important;
}
</style>