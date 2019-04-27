#version 300 es

uniform float half_wd;
uniform float half_ht;

in vec2 clip_space_pos;

out float eye_to_x;
out float eye_to_z;

void main() {
   eye_to_x = clip_space_pos.x * half_wd;
   eye_to_z = clip_space_pos.y * half_ht;
   gl_Position = vec4(clip_space_pos.xy, 0.0, 1.0);
}
