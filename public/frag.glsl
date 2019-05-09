#version 300 es

precision highp float;

const int SPHERE_COUNT = 2;

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

uniform Sphere spheres[SPHERE_COUNT];
uniform float eye_to_y;

in float eye_to_x;
in float eye_to_z;
in float random_n;

out vec4 color;

float random_v;

bool rayIntersectSphere(Ray r, Sphere s, float t0, float t1, out RayIntersectSphereResult res) {
    vec3  l = r.origin - s.center;
    float a = dot(r.dir, r.dir);
    float b = dot(r.dir, l) * 2.0;
    float c = dot(l, l) - s.radiusSquared;

    float discriminant = (b * b) - (4.0 * a * c);
    if (discriminant > 0.0) {
        float aa = 1.0 / (2.0 * a);
        float sq = sqrt(discriminant); 
        float t;

        t = (-b - sq) * aa;
        if (t0 < t) {
            res.t = t;
            res.pos = r.origin + (r.dir * t);
            res.nrm = normalize(res.pos - s.center);
            return true;
        }
        t = (-b + sq) * aa;
        if (t0 < t) {
            res.t = t;
            res.pos = r.origin + (r.dir * t);
            res.nrm = normalize(res.pos - s.center);
            return true;
        }
    }
    return false;
}

bool rayIntersectNearestSphere(Ray ray, float t0, float t1, out RayIntersectSphereResult nearest) {
    RayIntersectSphereResult current;
    bool contact = false;

    for (int i = 0; i < SPHERE_COUNT; ++i) {
        if (rayIntersectSphere(ray, spheres[i], t0, t1, current)) {
            if (!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}

uint hash(uint x) {
    // A single iteration of Bob Jenkins' One-At-A-Time hashing algorithm.
    x += ( x << 10u );
    x ^= ( x >>  6u );
    x += ( x <<  3u );
    x ^= ( x >> 11u );
    x += ( x << 15u );
    return x;
}

float floatConstruct(uint m) {
    // Construct a float with half-open range [0:1] using low 23 bits.
    // All zeroes yields 0.0, all ones yields the next smallest representable value below 1.0.
    const uint ieeeMantissa = 0x007FFFFFu; // binary32 mantissa bitmask
    const uint ieeeOne      = 0x3F800000u; // 1.0 in IEEE binary32
    m &= ieeeMantissa;                     // Keep only mantissa bits (fractional part)
    m |= ieeeOne;                          // Add fractional part to 1.0
    float  f = uintBitsToFloat( m );       // Range [1:2]
    return f - 1.0;                        // Range [0:1]
} 

float rand() { 
    // Pseudo-random value in half-open range [0:1]. 
    random_v = floatConstruct(hash(floatBitsToUint(random_v))); 
    return random_v;
}

vec3 randomPosInUnitSphere() {
    vec3 p;
    do { 
        p = vec3(rand(), rand(), rand()) * 2.0 + vec3(-1.0, -1.0, -1.0); 
    } while (dot(p, p) > 0.999);

    return p;
}

vec3 Color(Ray r, float t0, float t1) {
    RayIntersectSphereResult res;
    vec3 p;
    int  i;
    int  j;

    for (i = 0; i < 8; ++i) {
        if (!rayIntersectNearestSphere(r, t0, t1, res)) {
            break;
        }
        p = res.pos + res.nrm + randomPosInUnitSphere();
        r = Ray(res.pos, p - res.pos);
    }

    float t = (1.0 + normalize(r.dir).z) * 0.5;
    vec3  c = (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);

    for (j = 0; j < 8; ++j) {
        if (j == i) {
            break;
        }
        c *= 0.5;
    }

    return c;
}

void main() {
    random_v = random_n;

    Ray r;
    r.origin.x = 0.0;
    r.origin.y = 0.0;
    r.origin.z = 0.0;
    r.dir.x = 0.0;
    r.dir.y = eye_to_y;
    r.dir.z = 0.0;

    vec3 sum = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < 200; ++i) {
        r.dir.x = eye_to_x + rand();
        r.dir.z = eye_to_z + rand();
        sum += Color(r, 0.001, 9000.0);
    }

    color = vec4(sum / 200.0, 1.0);
}
