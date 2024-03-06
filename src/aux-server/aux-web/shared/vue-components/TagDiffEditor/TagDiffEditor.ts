import Vue from 'vue';
import Component from 'vue-class-component';
import MonacoLoader from '../MonacoLoader/MonacoLoader';
import MonacoLoaderError from '../MonacoLoaderError/MonacoLoaderError';

const MonacoAsync = () => ({
    component: import('../MonacoTagDiffEditor/MonacoTagDiffEditor').catch(
        (err) => {
            console.error('Unable to load Monaco diff editor:', err);
            throw err;
        }
    ),
    loading: MonacoLoader,
    error: MonacoLoaderError,

    delay: 50,
    timeout: 1000 * 60 * 5, // 5 minutes
});

export default MonacoAsync;
