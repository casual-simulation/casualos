module.exports = {
    findFirstVersionNumber: function(text) {
        const versionRegex = /v(\d+)\.(\d+)\.(\d+)/i;
        const result = versionRegex.exec(text);
        if (!result) {
            return null;
        }
        const [str, major, minor, patch] = result;
        return {
            major,
            minor,
            patch,
        };
    },

    formatVersionNumber: function({ major, minor, patch }) {
        return [major, minor, patch].join('.');
    },
};
