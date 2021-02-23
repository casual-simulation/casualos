// The MIT License

// Copyright © 2010-2021 three.js authors

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


import { Material, Vector2, Color, TangentSpaceNormalMap } from 'three';

/**
 * @author takahirox / http://github.com/takahirox
 *
 * parameters = {
 *  color: <hex>,
 *  specular: <hex>,
 *  shininess: <float>,
 *
 *  map: new THREE.Texture( <Image> ),
 *  gradientMap: new THREE.Texture( <Image> ),
 *
 *  lightMap: new THREE.Texture( <Image> ),
 *  lightMapIntensity: <float>
 *
 *  aoMap: new THREE.Texture( <Image> ),
 *  aoMapIntensity: <float>
 *
 *  emissive: <hex>,
 *  emissiveIntensity: <float>
 *  emissiveMap: new THREE.Texture( <Image> ),
 *
 *  bumpMap: new THREE.Texture( <Image> ),
 *  bumpScale: <float>,
 *
 *  normalMap: new THREE.Texture( <Image> ),
 *  normalMapType: THREE.TangentSpaceNormalMap,
 *  normalScale: <Vector2>,
 *
 *  displacementMap: new THREE.Texture( <Image> ),
 *  displacementScale: <float>,
 *  displacementBias: <float>,
 *
 *  specularMap: new THREE.Texture( <Image> ),
 *
 *  alphaMap: new THREE.Texture( <Image> ),
 *
 *  wireframe: <boolean>,
 *  wireframeLinewidth: <float>,
 *
 *  skinning: <bool>,
 *  morphTargets: <bool>,
 *  morphNormals: <bool>
 * }
 */

export class MeshToonMaterial extends Material {
    isMeshToonMaterial: boolean;
    color: Color;
    specular: Color;
    shininess: number;
    map: any;
    gradientMap: any;
    lightMap: any;
    lightMapIntensity: number;
    aoMap: any;
    aoMapIntensity: number;
    emissive: Color;
    emissiveIntensity: number;
    emissiveMap: any;
    bumpMap: any;
    bumpScale: number;
    normalMap: any;
    normalMapType: any;
    normalScale: Vector2;
    displacementMap: any;
    displacementScale: number;
    displacementBias: number;
    specularMap: any;
    alphaMap: any;
    wireframe: boolean;
    wireframeLinewidth: number;
    wireframeLinecap: string;
    wireframeLinejoin: string;
    skinning: boolean;
    morphTargets: boolean;
    morphNormals: boolean;
    
    constructor(parameters: any) {
        super();

        this.defines = { 'TOON': '' };

        this.type = 'MeshToonMaterial';
    
        this.color = new Color( 0xffffff );
        this.specular = new Color( 0x111111 );
        this.shininess = 30;
    
        this.map = null;
        this.gradientMap = null;
    
        this.lightMap = null;
        this.lightMapIntensity = 1.0;
    
        this.aoMap = null;
        this.aoMapIntensity = 1.0;
    
        this.emissive = new Color( 0x000000 );
        this.emissiveIntensity = 1.0;
        this.emissiveMap = null;
    
        this.bumpMap = null;
        this.bumpScale = 1;
    
        this.normalMap = null;
        this.normalMapType = TangentSpaceNormalMap;
        this.normalScale = new Vector2( 1, 1 );
    
        this.displacementMap = null;
        this.displacementScale = 1;
        this.displacementBias = 0;
    
        this.specularMap = null;
    
        this.alphaMap = null;
    
        this.wireframe = false;
        this.wireframeLinewidth = 1;
        this.wireframeLinecap = 'round';
        this.wireframeLinejoin = 'round';
    
        this.skinning = false;
        this.morphTargets = false;
        this.morphNormals = false;
        this.isMeshToonMaterial = true;
    
        this.setValues( parameters );
    }

    copy(source: any): this {
        super.copy(source);

        this.color.copy( source.color );
        this.specular.copy( source.specular );
        this.shininess = source.shininess;

        this.map = source.map;
        this.gradientMap = source.gradientMap;

        this.lightMap = source.lightMap;
        this.lightMapIntensity = source.lightMapIntensity;

        this.aoMap = source.aoMap;
        this.aoMapIntensity = source.aoMapIntensity;

        this.emissive.copy( source.emissive );
        this.emissiveMap = source.emissiveMap;
        this.emissiveIntensity = source.emissiveIntensity;

        this.bumpMap = source.bumpMap;
        this.bumpScale = source.bumpScale;

        this.normalMap = source.normalMap;
        this.normalMapType = source.normalMapType;
        this.normalScale.copy( source.normalScale );

        this.displacementMap = source.displacementMap;
        this.displacementScale = source.displacementScale;
        this.displacementBias = source.displacementBias;

        this.specularMap = source.specularMap;

        this.alphaMap = source.alphaMap;

        this.wireframe = source.wireframe;
        this.wireframeLinewidth = source.wireframeLinewidth;
        this.wireframeLinecap = source.wireframeLinecap;
        this.wireframeLinejoin = source.wireframeLinejoin;

        this.skinning = source.skinning;
        this.morphTargets = source.morphTargets;
        this.morphNormals = source.morphNormals;

        return this;
    }
}