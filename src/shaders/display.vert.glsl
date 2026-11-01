// Vertex shader for the display pass: places the screen-covering triangle.
//
// The triangle's corners are already in clip space, so each position passes straight through. The display pass draws
// one such triangle over the whole canvas, and `src/shaders/display.frag.glsl` shades every pixel of it.

precision highp int;
precision highp float;

// --- attributes ----------------------------------------------------------------------
in vec3 position;

// --- main ----------------------------------------------------------------------------
void main() {
   gl_Position = vec4(position.xy, 0.0, 1.0);
}
