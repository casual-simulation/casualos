import {visit} from 'unist-util-visit'
import useBaseUrl from '@docusaurus/useBaseUrl';
import { tagMap } from '../components';

export default function remarkTagLinks(options = {}) {
    const references = options.references;
    return (tree) => {
        visit(tree, 'link', (node) => {
            if (node.url.startsWith('tags:')) {
                const tag = node.url.slice('tags:'.length);
                
                if (tag.startsWith('@')) {
                    node.url = useBaseUrl('tags/listen') + formatTagHash(tag.slice(1));
                } else {
                    node.url = useBaseUrl(tagMap[tag]) + formatTagHash(tag);
                }
            } else if (node.url.startsWith('ref:')) {
                const ref = node.url.slice('ref:'.length);
                const hash = references[ref];
                node.url = useBaseUrl(hash) + '#' + ref;
            } else if (node.url.startsWith('glossary:')) {
                const term = node.url.slice('glossary:'.length);
                node.url = useBaseUrl('glossary') + '#' + formatAnchorId(term);
            } else if (node.url.startsWith('page:')) {
                const [page, hash] = node.url.slice('page:'.length).split('#');
                node.url = useBaseUrl(page) + '#' + hash;
            }
        });
    };
}

function formatTagHash(tag) {
    return '#' + formatAnchorId(tag);
}

function formatAnchorId(id) {
    return id.replace(/[\.\(\)\@\[\]]/g, '').toLowerCase()
}