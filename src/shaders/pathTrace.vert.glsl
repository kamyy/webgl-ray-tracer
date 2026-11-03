// Vertex shader for the path-tracing pass: places the fullscreen triangle and aims each pixel's ray.
//
// The triangle's corners are in clip space at (-1, -1), (3, -1) and (-1, 3), and the render target is the part from
// -1 to 1 on both axes. Scaling a position by half the render size gives its place on the image plane, measured from
// the image center in pixels. At the target's edges that is plus or minus half the width and height. The GPU
// interpolates the values across the triangle, so every pixel gets its own, and the fragment shader
// (`src/shaders/pathTrace.frag.glsl`) turns it into a ray direction.

precision highp int;
precision highp float;

// --- uniforms ------------------------------------------------------------------------
uniform float u_half_wd;
uniform float u_half_ht;

// --- attributes ----------------------------------------------------------------------
in vec3 position;

// --- varyings ------------------------------------------------------------------------
out float v_eye_to_x;
out float v_eye_to_y;

// --- main ----------------------------------------------------------------------------
void main() {
   v_eye_to_x = position.x * u_half_wd;
   v_eye_to_y = position.y * u_half_ht;
   gl_Position = vec4(position.xy, 0.0, 1.0);
}
