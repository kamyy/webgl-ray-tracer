#version 300 es
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
in vec2 a_vert_data;

// ----------------------------------------------------------------------------
// varyings
//
out float v_eye_to_x;
out float v_eye_to_z;

// ----------------------------------------------------------------------------
// main
//
void main() {
   v_eye_to_x = a_vert_data.x * u_half_wd;
   v_eye_to_z = a_vert_data.y * u_half_ht;
   gl_Position = vec4(a_vert_data, 0.0, 1.0);
}
