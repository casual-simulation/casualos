import { testDocumentImplementation } from './test/DocumentTests';
import { YjsSharedDocument } from './YjsSharedDocument';

console.log = jest.fn();

describe('YjsSharedDocument', () => {
    testDocumentImplementation(async () => {
        return new YjsSharedDocument({
            branch: 'testBranch',
        });
    });

    // function setupPartition(config: SharedDocumentConfig) {
    //     document = new RemoteYjsSharedDocument(
    //         client,
    //         authSource,
    //         config
    //     );

    //     sub.add(document);
    //     sub.add(document.onError.subscribe((e) => errors.push(e)));
    //     sub.add(
    //         document.onVersionUpdated.subscribe((v) => (version = v))
    //     );
    // }
});
