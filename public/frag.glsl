#version 300 es

precision mediump float;

struct Ray {
    vec3 origin;
    vec3 dir;
};

struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
};

struct RayIntersectSphereResult {
    vec3 p;
    vec3 n;
};

const int MAX_SPHERE_COUNT = 8;
uniform Sphere spheres[MAX_SPHERE_COUNT];

in float      eye_to_x;
uniform float eye_to_y;
in float      eye_to_z;

out vec4      outColor;

bool rayIntersectSphere(Ray ray, Sphere sphere, float t0, float t1, out RayIntersectSphereResult result) {
    vec3  l = ray.origin - sphere.center;
    float a = dot(ray.dir, ray.dir);
    float b = dot(ray.dir, l) * 2.0;
    float c = dot(l, l) - sphere.radiusSquared;

    float discriminant = (b * b) - (4.0 * a * c);
    if (discriminant > 0.0) {
        float aa = 1.0 / (2.0 * a);
        float sq = sqrt(discriminant); 
        float t;

        t = (-b - sq) * aa;
        if (t0 < t && t < t1) {
            result.p = ray.origin + (ray.dir * t);
            result.n = normalize(result.p - sphere.center);
            return true;
        }

        t = (+b - sq) * aa;
        if (t0 < t && t < t1) {
            result.p = ray.origin + (ray.dir * t);
            result.n = normalize(result.p - sphere.center);
            return true;
        }
    }
    return false;
}

float rand(vec2 v) {
    return fract(sin(dot(v.xy, vec2(12.9898,78.233))) * 43758.5453);
}

vec3 randInUnitSphere() {
    vec3 v = vec3( rand( vec2(eye_to_x, eye_to_y) ),
                   rand( vec2(eye_to_y, eye_to_z) ),
                   rand( vec2(eye_to_z, eye_to_x) ) ) * 2.0 - vec3(1.0, 1.0, 1.0);
    while (dot(v, v) > 1.0) {
        v.x = rand(vec2(v.x, v.y));
        v.y = rand(vec2(v.y, v.z));
        v.z = rand(vec2(v.z, v.x));
        v = v * 2.0 - vec3(1.0, 1.0, 1.0);
    }
    return v;
}

void main() {
    Ray r = Ray(
        vec3(0.0, 0.0, 0.0), 
        vec3(eye_to_x, eye_to_y, eye_to_z)
    );

    Sphere s = Sphere(
        vec3(-50.0, 100.0, 0.0),
        30.0,
        30.0 * 30.0
    );

    RayIntersectSphereResult result;

    randInUnitSphere();

    if (rayIntersectSphere(r, s, 0.0, 1000.0, result)) {
        outColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        outColor = vec4(0.0, 0.0, 0.5, 1.0);
    }
}
