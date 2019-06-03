#version 300 es

// ----------------------------------------------------------------------------
// uniforms
//
uniform float u_half_wd;
uniform float u_half_ht;

// ----------------------------------------------------------------------------
// attributes
//
in vec4 a_vert_data;

// ----------------------------------------------------------------------------
// varyings
//
out float v_eye_to_x;
out float v_eye_to_z;

out vec2  v_tuv;

// ----------------------------------------------------------------------------
// main
//
void main() {
   v_eye_to_x = a_vert_data.x * u_half_wd;
   v_eye_to_z = a_vert_data.y * u_half_ht;
   v_tuv = vec2(a_vert_data.zw);

   gl_Position =  vec4(a_vert_data.xy, 0.0, 1.0);
}
