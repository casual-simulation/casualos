import * as React from 'react';
import clsx from 'clsx';
import {
    PageMetadata,
    HtmlClassNameProvider,
    ThemeClassNames,
} from '@docusaurus/theme-common';
import DocPage from '@theme/DocPage';

export default function ApiPage({ apiInfo }) {

    const content = <div>
        Hello {apiInfo.hash}!
    </div>

    return <DocPage content={content}/>
}