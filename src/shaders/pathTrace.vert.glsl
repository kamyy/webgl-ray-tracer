precision highp int;
precision highp float;

// ----------------------------------------------------------------------------
// uniforms
//
uniform float u_half_wd;
uniform float u_half_ht;

// ----------------------------------------------------------------------------
// attributes
//
in vec3 position;

// ----------------------------------------------------------------------------
// varyings
//
out float v_eye_to_x;
out float v_eye_to_y;

// ----------------------------------------------------------------------------
// main
//
void main() {
   v_eye_to_x = position.x * u_half_wd;
   v_eye_to_y = position.y * u_half_ht;
   gl_Position = vec4(position.xy, 0.0, 1.0);
}
