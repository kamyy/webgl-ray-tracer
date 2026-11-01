precision highp int;
precision highp float;

// ----------------------------------------------------------------------------
// uniforms
//
uniform highp sampler2D u_color_sampler; // running sum of sample colors in rgb, sample count in alpha

// ----------------------------------------------------------------------------
// outputs
//
out vec4 o_color;

// ----------------------------------------------------------------------------
// main
//
void main() {
    vec4 sum = texelFetch(u_color_sampler, ivec2(gl_FragCoord.xy), 0);
    vec3 avgColor = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0.0);
    o_color = vec4(avgColor, 1.0);
}
