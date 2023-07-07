import {visit} from 'unist-util-visit'
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function remarkTagLinks(options = {}) {
    const references = options.references;
    return (tree) => {
        visit(tree, 'link', (node) => {
            if (node.url.startsWith('tags:')) {
                const tag = node.url.slice('tags:'.length);
                
                if (tag.startsWith('@')) {
                    node.url = useBaseUrl('listen-tags') + formatTagHash(tag.slice(1));
                } else {
                    node.url = useBaseUrl('tags') + formatTagHash(tag);
                }
            } else if (node.url.startsWith('ref:')) {
                const ref = node.url.slice('ref:'.length);
                const hash = references[ref];
                node.url = useBaseUrl(hash) + '#' + ref;
            }
        });
    };
}

function formatTagHash(tag) {
    return '#' + tag.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()
}