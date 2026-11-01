// Vertex shader for the path-tracing pass: places the screen-covering triangle and aims each pixel's ray.
//
// The triangle's corners are in clip space, from -1 to 1. Scaling them by half the render size gives each pixel's
// position on the image plane, measured from the image center in pixels, which the fragment shader
// (`src/shaders/pathTrace.frag.glsl`) turns into a ray direction. The GPU interpolates the values across the triangle.

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
