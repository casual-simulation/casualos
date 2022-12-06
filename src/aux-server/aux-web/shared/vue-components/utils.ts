import Vue from 'vue';

export function getActiveTheme() {
    return `md-theme-${(Vue as any).material.theming.theme || 'default'}`;
}
