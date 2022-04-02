import React, { useState } from 'react';

/**
 * 
 * @param {*} param0 
 * @returns 
 */
function Article({ header = "Article", description = "A new article, displaying information", image = "", footer = "Author, Notes, Etc.", headerStyle = { backgroundColor: "rgba(0,0,0,.1)", margin: "0 0 1rem 0", padding: '1rem', borderTopLeftRadius: "2rem", borderTopRightRadius: "2rem" }, descriptionStyle = {}, imageStyle = {}, footerStyle = {}, containerStyle = { backgroundColor: "rgba(200,200,200,.1)", borderRadius: "2rem", margin: "1rem 0", boxShadow: "0 0 .1rem .1rem rgba(120,120,120,.1)" } }) {
    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>{header}</h2>
            <p style={descriptionStyle}>{description}</p>
            <img src={image} alt="Article Image" style={imageStyle}></img>
            <p style={footerStyle}>{footer}</p>
        </div>
    )
}

export { Article }