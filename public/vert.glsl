#version 300 es

uniform float uni_half_wd;
uniform float uni_half_ht;
in vec3  att_vert_data;
out float var_eye_to_x;
out float var_eye_to_z;
out float var_random_n;

void main() {
   var_eye_to_x = att_vert_data.x * uni_half_wd;
   var_eye_to_z = att_vert_data.y * uni_half_ht;
   var_random_n = att_vert_data.z;
   
   gl_Position =  vec4(att_vert_data.xy, 0.0, 1.0);
}
