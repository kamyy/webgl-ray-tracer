// Fragment shader for the display pass: turns the accumulated sum into the picture on the canvas.
//
// The path-tracing pass adds one sample per pixel to a running sum in the accumulation texture and counts the samples
// in the alpha channel. This shader divides the sum by that count to get the average color. A pixel with no samples
// yet is drawn black.
//
// The average is linear light with no upper limit, and the browser shows canvas pixels as sRGB values from 0 to 1. The
// shader applies the contrast and exposure settings and tone maps the result. A tone map is a curve that squeezes
// brightness of any size into the 0 to 1 a screen can show, keeping detail in the bright areas. The shader then
// encodes the result to sRGB. three.js does none of this for a raw shader material, and WebGL 2 cannot make the
// canvas encode on write. The settings act on the finished average, so changing them redraws the picture without
// tracing any sample again.

precision highp int;
precision highp float;

// --- constants -----------------------------------------------------------------------
// The brightest value passed to the tone curve. The curve squares its input, so a far brighter pixel, such as a single
// sample that lands next to a strong light, would overflow to infinity and come out as an undefined color. Anything
// this bright is already drawn as white.
const float MAX_GRADED = 1e4;

// --- uniforms ------------------------------------------------------------------------
uniform highp sampler2D u_color_sampler; // running sum of sample colors in rgb, sample count in alpha
uniform float u_exposure; // multiplies the linear average, like a camera's exposure setting
uniform float u_contrast; // the power the linear average is raised to. Above 1 deepens shadows and keeps 1 at 1.

// --- outputs -------------------------------------------------------------------------
out vec4 o_color;

// --- color conversion ----------------------------------------------------------------
// Krzysztof Narkowicz's fit of the tone curve from ACES (the Academy Color Encoding System, the film industry's color
// standard), which imitates how photographic film responds to light. It keeps dark and middle values close to linear
// and bends bright ones towards 1, so a light and its reflection stay distinct instead of clipping to the same white.
vec3 acesFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// The exact sRGB encoding curve: a straight segment near black, then a power curve.
vec3 linearToSrgb(vec3 c) {
    return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// --- main ----------------------------------------------------------------------------
void main() {
    vec4 sum = texelFetch(u_color_sampler, ivec2(gl_FragCoord.xy), 0);
    vec3 avgColor = sum.a > 0.0 ? sum.rgb / sum.a : vec3(0.0);
    vec3 graded = min(u_exposure * pow(avgColor, vec3(u_contrast)), vec3(MAX_GRADED));
    o_color = vec4(linearToSrgb(acesFilm(graded)), 1.0);
}
