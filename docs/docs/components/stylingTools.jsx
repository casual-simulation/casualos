import React, { useState } from 'react';


/**
 * 
 * @param {*} param0 
 * @returns 
 */
function Article({ header = "Article", description = "A new article, displaying information", image = "", footer = "Author, Notes, Etc.", styles = { header: { color: "black" }, description: { color: "black" }, image: { color: "black" }, footer: { color: "black" } } }) {
    return (
        <div>
            <h2 style={styles.header}>{header}</h2>
            <p style={styles.description}>{description}</p>
            <img src={image} alt="Article Image" style={styles.image}></img>
            <p style={styles.footer}>{footer}</p>
        </div>
    )
}

export { Article }