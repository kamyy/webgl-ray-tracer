#version 300 es

precision highp float;

// ----------------------------------------------------------------------------
// structures
//
struct Ray {
    vec3 origin;
    vec3 dir;
};

struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialClass;
    int   materialIndex;
};

struct MetallicMaterial {
    vec3  albedo;
    float fuzziness;
};

struct LambertianMaterial {
    vec3  albedo;
};

struct DielectricMaterial {
    vec3  albedo;
};

struct RayIntersectSphereResult {
    float t;
    vec3  pos;
    vec3  nrm;
    int   materialClass;
    int   materialIndex;
};

// ----------------------------------------------------------------------------
// constants
//
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.001;

const int METALLIC_MATERIAL   = 0;
const int LAMBERTIAN_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int MAX_SPHERES   = 32;
const int MAX_MATERIALS = 8;

// ----------------------------------------------------------------------------
// uniforms
//
uniform Sphere u_spheres[MAX_SPHERES];
uniform MetallicMaterial u_metallic_materials[MAX_MATERIALS];
uniform LambertianMaterial u_lambertian_materials[MAX_MATERIALS];
uniform DielectricMaterial u_dielectric_materials[MAX_MATERIALS];

uniform int u_num_spheres;
uniform int u_num_samples;
uniform int u_num_bounces;

uniform float u_eye_to_y;

// ----------------------------------------------------------------------------
// varyings
//
in float v_eye_to_x;
in float v_eye_to_z;
in float v_random_n;

// ----------------------------------------------------------------------------
// outputs
//
out vec4 o_color;

// ----------------------------------------------------------------------------
// randomness
//
float g_random_v;

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
    g_random_v = floatConstruct(hash(floatBitsToUint(g_random_v)));
    return g_random_v;
}

vec3 randPosInUnitSphere() {
    vec3 p;

    do {
        p = 2.0 * vec3(rand(), rand(), rand()) + vec3(-1.0, -1.0, -1.0);
    } while (dot(p, p) > 1.0);

    return p;
}

// ----------------------------------------------------------------------------
// intersect
//
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
        if (t0 < t && t < t1) {
            res.t = t;
            res.pos = r.origin + (r.dir * t);
            res.nrm = normalize(res.pos - s.center);
            res.materialClass = s.materialClass;
            res.materialIndex = s.materialIndex;
            return true;
        }
        t = (-b + sq) * aa;
        if (t0 < t && t < t1) {
            res.t = t;
            res.pos = r.origin + (r.dir * t);
            res.nrm = normalize(res.pos - s.center);
            res.materialClass = s.materialClass;
            res.materialIndex = s.materialIndex;
            return true;
        }
    }
    return false;
}

bool rayIntersectNearestSphere(Ray ray, float t0, float t1, out RayIntersectSphereResult nearest) {
    RayIntersectSphereResult current;
    bool contact = false;

    for (int i = 0; i < u_num_spheres; ++i) {
        if (rayIntersectSphere(ray, u_spheres[i], t0, t1, current)) {
            if (!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}

// ----------------------------------------------------------------------------
// cast ray from eye through pixel
//
vec3 pixelRayCast(Ray ray, float a, float b) {
    vec3 color = vec3(1.0, 1.0, 1.0);
    RayIntersectSphereResult res;

    MetallicMaterial   metallic;
    LambertianMaterial lambertian;
    DielectricMaterial dielectric;

    for (int i = 0; i < u_num_bounces; ++i) {
        if (rayIntersectNearestSphere(ray, a, b, res)) {
            switch (res.materialClass) {
            case METALLIC_MATERIAL:
                metallic = u_metallic_materials[res.materialIndex];
                ray = Ray(
                    res.pos, normalize(reflect(ray.dir, res.nrm)) + 
                    metallic.fuzziness * randPosInUnitSphere()
                );
                if (dot(ray.dir, res.nrm) > 0.0) {
                    color *= metallic.albedo;
                } else {
                    return vec3(0.0, 0.0, 0.0);
                }
                break;
            case LAMBERTIAN_MATERIAL:
                lambertian = u_lambertian_materials[res.materialIndex];
                ray = Ray(res.pos, res.nrm + randPosInUnitSphere());
                color *= lambertian.albedo;
                break;
            case DIELECTRIC_MATERIAL:
                dielectric = u_dielectric_materials[res.materialIndex];
                break;
            }
        } else {
            float t = (1.0 + normalize(ray.dir).z) * 0.5;
            color *= t * vec3(1.0, 1.0, 1.0) + (1.0 - t) * vec3(0.5, 0.7, 1.0);
            break;
        }
    }

    return color;
}

// ----------------------------------------------------------------------------
// main
//
void main() {
    g_random_v = v_random_n;

    Ray r;
    r.origin.x = 0.0;
    r.origin.y = 0.0;
    r.origin.z = 0.0;
    r.dir.y = u_eye_to_y;

    vec3 sum = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < u_num_samples; ++i) {
        r.dir.x = v_eye_to_x + rand();
        r.dir.z = v_eye_to_z + rand();
        sum += pixelRayCast(r, EPSILON, MAX_FLT);
    }

    o_color = vec4(sum / float(u_num_samples), 1.0);
}
