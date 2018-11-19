
import Vue, { ComponentOptions } from 'vue';

const world: ComponentOptions<Vue> = {
    data() {
        return {message: 'Hello, World!'};
    }
};

export default world;