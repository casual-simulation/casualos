
export default function unwrapFirstParagraph(options = {}) {
    return (tree) => {
        if (tree && tree.children && tree.children.length > 0 && tree.children[0].type === 'paragraph') {
            tree.children = tree.children[0].children.concat(tree.children.slice(1));
        }
    };
}