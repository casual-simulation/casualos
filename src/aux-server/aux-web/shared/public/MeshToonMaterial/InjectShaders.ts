import { Color, ShaderChunk, ShaderLib, UniformsLib } from 'three';
import { mergeUniforms } from 'three/src/renderers/shaders/UniformsUtils';
import lights_toon_fragment from './lights_toon_fragment';
import lights_toon_pars_fragment from './lights_toon_pars_fragment';
import meshtoon_frag from './meshtoon_frag';
import meshtoon_vert from './meshtoon_vert';

ShaderChunk['lights_toon_fragment'] = lights_toon_fragment;
ShaderChunk['lights_toon_pars_fragment'] = lights_toon_pars_fragment;

ShaderLib.toon = {

    uniforms: mergeUniforms( [
        UniformsLib.common,
        UniformsLib.specularmap,
        UniformsLib.aomap,
        UniformsLib.lightmap,
        UniformsLib.emissivemap,
        UniformsLib.bumpmap,
        UniformsLib.normalmap,
        UniformsLib.displacementmap,
        UniformsLib.gradientmap,
        UniformsLib.fog,
        UniformsLib.lights,
        {
            emissive: { value: new Color( 0x000000 ) },
            specular: { value: new Color( 0x111111 ) },
            shininess: { value: 30 }
        }
    ] ),

    vertexShader: meshtoon_vert,
    fragmentShader: meshtoon_frag

};