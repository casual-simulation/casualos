import React from 'react';

export class ReflectionBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        const description = `[${this.props.reflection.name}] ${error}`;
        if (!this.props.root) {
            throw description;
        } else {
            // You can also log the error to an error reporting service
            console.error(description);
        }
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return <h1>[{this.props.reflection.name}] {this.state.error}</h1>;
        }

        return this.props.children;
    }
}