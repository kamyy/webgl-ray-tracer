#version 300 es

uniform float half_wd;
uniform float half_ht;

in vec3  vert_data;

out float eye_to_x;
out float eye_to_z;
out float random_n;

void main() {
   eye_to_x = vert_data.x * half_wd;
   eye_to_z = vert_data.y * half_ht;
   random_n = vert_data.z;
   
   gl_Position =  vec4(vert_data.xy, 0.0, 1.0);
}
