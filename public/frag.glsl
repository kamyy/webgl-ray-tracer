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
    float t;
    vec3  pos;
    vec3  nrm;
};

const int MAX_SPHERE_COUNT = 8;
uniform Sphere spheres[MAX_SPHERE_COUNT];

in float      eye_to_x;
uniform float eye_to_y;
in float      eye_to_z;

out vec4      color;

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
            result.t = t;
            result.pos = ray.origin + (ray.dir * t);
            result.nrm = normalize(result.pos - sphere.center);
            return true;
        }

        t = (+b - sq) * aa;
        if (t0 < t && t < t1) {
            result.t = t;
            result.pos = ray.origin + (ray.dir * t);
            result.nrm = normalize(result.pos - sphere.center);
            return true;
        }
    }
    return false;
}

bool rayIntersectNearestSphere(Ray ray, float t0, float t1, out RayIntersectSphereResult nearest) {
    RayIntersectSphereResult current;
    bool contact = false;

    for (int i = 0; i < MAX_SPHERE_COUNT; ++i) {
        if (rayIntersectSphere(ray, sphere[i], t0, t1, current))
            if(!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}

float rand(vec2 v) {
    return fract(sin(dot(v.xy, vec2(12.9898,78.233))) * 43758.5453);
}

vec3 randomPosInUnitSphere() {
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

vec3 f4(Ray ray) {
}

vec3 f3(Ray ray) {
    RayIntersectSphereResult r;

    if (rayIntersectNearestSphere(ray, 0.0, 1.0, r)) {
        vec3 end = r.pos + r.nrm + randomPosInUnitSphere();
        Ray ray3 = Ray(r.pos, end - r.pos);
        return f4(ray3) * .5;
    }
    vec3  n = normalize(ray.dir);
    float t = 0.5 * n.z + 1.0;
    return (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
}

vec3 f0(Ray ray) {
    RayIntersectSphereResult r;

    if (rayIntersectNearestSphere(ray, 0.0, 1.0, r)) {
        vec3 end = r.pos + r.nrm + randomPosInUnitSphere();
        Ray ray0 = Ray(r.pos, end - r.pos);
        return f1(ray0) * .5;
    } 
    vec3  n = normalize(ray.dir);
    float t = 0.5 * n.z + 1.0;
    return (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
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


    if (rayIntersectSphere(r, s, 0.0, 1000.0, result)) {


        color = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        color = vec4(0.0, 0.0, 0.5, 1.0);
    }
}
