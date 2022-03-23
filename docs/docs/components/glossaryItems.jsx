import React, { useState } from 'react';

/**
 * 
 * @param {string} title The title to place inside of the Header.
 * @param {object} style The style of the header containing the Title
 * @param {object} containerStyle The style of the div containing the Header
 * @returns {JSX.Element} JSX Title element ;) 
 */
function Title({ title = "Title", style = { color: '#000000' }, containerStyle = { color: '#000000' } }) {
    return (
        <div style={containerStyle}>
            <h4 style={style}>{title}</h4>
        </div>
    )
}

/**
 * 
 * @param {Array} headers The headers to use in the table.
 * @param {[[]]} items An array of data Arrays.
 * @param {table:{},rows:{},headers:{},item:{}} tableStyles The styles for each table element
 * @example 
 * <Table headers={["Name","Age"]} items=[["Joe","26"],["Jim","34"]] />
 * @returns {JSX.Element}
 */
function Table({ headers = ["ID1", "ID2"], items = [["Item1", "Item2"], ["Item3", "Item4"]], tableStyles = { table: { color: '#000000' }, rows: { color: '#000000' }, headers: { color: '#000000' }, item: { color: '#000000' } } }) {
    return (
        <div>
            <table style={tableStyles.table}>
                <tr style={tableStyles.rows}>
                    {headers.map(header => {
                        return (
                            <th style={tableStyles.headers} >{header}</th>
                        )
                    })}
                </tr>
                {items.map(row => {
                    return (
                        <tr style={tableStyles.rows}>
                            {row.map(item => {
                                return (
                                    <td style={tableStyles.item}>{item}</td>
                                )
                            })}
                        </tr>
                    )
                })}
            </table>
        </div>
    )
}

/**
 * Reverses the path, if fullPath is left true, then it parses the last full path, otherwise it parses files, id anchors, etc.
 * @param {boolean} fullPath Whether or not the returned should be a directory path. If true the returned path will be the last directory, otherwise it parses files, id anchors, etc.
 * @returns {string} Returns the last path as a string.
 */
function lastPath(fullPath = true) {
    if (fullPath) {
        const path = document.location.pathname;
        const htap = path.split("").reverse().join("");
        const htapTsal = htap.substring(htap.indexOf("/") + 1, htap.indexOf("/", htap.indexOf("/") + 1));
        const lastPath = htapTsal.split("").reverse().join("");
        return (lastPath);
    } else {
        const path = document.location.pathname;
        const hash = path.lastIndexOf("#") == -1 ? path.length : path.lastIndexOf("#");
        const lastPath = path.substring(path.lastIndexOf("/") + 1,hash);
        return (lastPath);
    }
}

/**
 * This function is used SOULY for id anchors. Its existence is justified by allowing links to be dynamic to the relative page.
 * @param {string} linkValue The id anchor to append after the last path (DO NOT INCLUDE THE # its already included).
 * @param {string} lastFullPath The last path to check for, if the given value is the last path then the given link will be appended otherwise, it will replace the most recent path.
 * @param {string} linkName The innerHTML of the a tag (link)
 * @returns {JSX.Element}
 */
function LinkPath({ linkValue, lastFullPath, linkName }) {
    return (
        <a onClick={() => {
            if (lastPath(false) == lastFullPath) {
                document.location.hash = `#` + linkValue;
            } else {
                const newPath = document.location.pathname.substring(0, document.location.pathname.length - (lastPath().length + 2));
                const newURL = new URL(document.URL);
                newURL.pathname = newPath;
                newURL.hash = `#` + linkValue; 
                document.location.href = newURL;
            }
        }}>{linkName}</a>
    )
}

export { Title, Table, LinkPath };