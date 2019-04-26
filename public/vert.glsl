#version 300 es

in vec2 a_clip_space_pos;

void main() {
   gl_Position = vec4(a_clip_space_pos.xy, 0.0, 1.0);
}
