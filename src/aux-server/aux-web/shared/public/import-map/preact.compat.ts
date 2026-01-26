import React from 'preact/compat';

// Re-export all React exports to support both named and default imports
export const {
    isValidElement,
    createElement,
    Fragment,
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
    useContext,
    Children,
    cloneElement,
    createContext,
    forwardRef,
    lazy,
    memo,
    PureComponent,
    Suspense,
    Component,
    startTransition,
    useDebugValue,
    useDeferredValue,
    useId,
    useImperativeHandle,
    useInsertionEffect,
    useLayoutEffect,
    useReducer,
    useSyncExternalStore,
    useTransition,
    createRef,
    StrictMode,
    SuspenseList,

    // react-dom
    createFactory,
    createPortal,
    hydrate,
    isFragment,
    render,
    findDOMNode,
    flushSync,
    unmountComponentAtNode,
    unstable_batchedUpdates,
    unstable_runWithPriority,
    unstable_IdlePriority,
    unstable_ImmediatePriority,
    unstable_LowPriority,
    unstable_NormalPriority,
    unstable_UserBlockingPriority,
    unstable_now,
    version
} = React;

export default React

// Export the URL for the import map
export const url = import.meta.url;