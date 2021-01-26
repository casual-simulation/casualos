import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { render, fireEvent } from '@testing-library/vue';
import CustomPortal from './CustomPortal';

describe('CustomPortal.vue', () => {
    it('should render an iframe that uses the given VM Origin', () => {
        const { getByTitle } = render(CustomPortal, {
            props: {
                vmOrigin: 'http://example.com',
                portalId: 'my-portal',
            },
        });

        const iframeElement = getByTitle('my-portal');

        expect(iframeElement).toBeInTheDocument();
        expect(iframeElement).toBeInstanceOf(HTMLIFrameElement);
        expect(iframeElement).toHaveAttribute(
            'src',
            'http://example.com/aux-vm-iframe.html'
        );
    });
});
