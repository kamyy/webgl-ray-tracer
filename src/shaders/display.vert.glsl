precision highp int;
precision highp float;

// ----------------------------------------------------------------------------
// attributes
//
in vec3 position;

// ----------------------------------------------------------------------------
// main
//
void main() {
   gl_Position = vec4(position.xy, 0.0, 1.0);
}
