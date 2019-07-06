#version 300 es
precision highp int;
precision highp float;

// ----------------------------------------------------------------------------
// uniforms
//
uniform highp sampler2D u_color_sampler;
uniform float u_inv_render_pass;

// ----------------------------------------------------------------------------
// outputs
//
out vec4 o_color;

// ----------------------------------------------------------------------------
// main
//
void main() {
    vec3 avgColor = texelFetch(u_color_sampler, ivec2(gl_FragCoord.xy), 0).xyz * u_inv_render_pass;
    o_color = vec4(avgColor, 1.0);
    //o_color = vec4(texelFetch(u_color_sampler, ivec2(gl_FragCoord.xy), 0).xyz, 1.0);
}
