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
    vec3  attenuation;
    float shininess;
};

struct LambertianMaterial {
    vec3  attenuation;
};

struct DielectricMaterial {
    vec3  attenuation;
    float refractionIndex;
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
// ray cast from eye through pixel
//
float schlick(float cosine, float rindex) {
    float r0 = (1.0 - rindex) / (1.0 + rindex);
    r0 *= r0;
    
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayHitMetallicSurface(RayIntersectSphereResult res, inout Ray ray, inout vec3 color) {
    MetallicMaterial metallic = u_metallic_materials[res.materialIndex];

    vec3 reflection = reflect(ray.dir, res.nrm);
    ray = Ray(  res.pos, 
                normalize(reflection + (1.0 - metallic.shininess) * randPosInUnitSphere())
                );

    if (dot(ray.dir, res.nrm) > 0.0) {
        color *= metallic.attenuation;
    } else {
        color = vec3(0.0, 0.0, 0.0);
    }
}

void rayHitLambertianSurface(RayIntersectSphereResult res, inout Ray ray, inout vec3 color) {
    LambertianMaterial lambertian = u_lambertian_materials[res.materialIndex];
    ray = Ray(  res.pos, 
                normalize(res.nrm + randPosInUnitSphere())
                );
    color *= lambertian.attenuation;
}

void rayHitDielectricSurface(RayIntersectSphereResult res, inout Ray ray, inout vec3 color) {
    DielectricMaterial dielectric = u_dielectric_materials[res.materialIndex];
    float cosine;
    float rindex;
    float reflectionProbability;
    vec3  refraction;
    vec3  normal;
    vec3  dir;

    dir = normalize(ray.dir);

    if (dot(dir, res.nrm) > 0.0) { // from sphere into air
        rindex = dielectric.refractionIndex;
        cosine = rindex * dot(dir, res.nrm);
        normal = -res.nrm;
    } else { // into sphere from air
        rindex = 1.0 / dielectric.refractionIndex;
        cosine = -dot(dir, res.nrm);
        normal = +res.nrm;
    }

    refraction = refract(dir, normal, rindex);
    if (dot(refraction, refraction) > 0.0) {
        reflectionProbability = schlick(cosine, rindex);
    } else {
        reflectionProbability = 1.0;
    }

    if (rand() < reflectionProbability) {
        ray = Ray(res.pos, reflect(dir, res.nrm));
    } else {
        ray = Ray(res.pos, refraction);
    } 

    color *= dielectric.attenuation;
}

vec3 castPrimaryRay(Ray ray, float t0, float t1) {
    vec3 color = vec3(1.0, 1.0, 1.0);
    RayIntersectSphereResult res;

    for (int i = 0; i < u_num_bounces; ++i) {
        if (rayIntersectNearestSphere(ray, t0, t1, res)) {
            switch (res.materialClass) {
            case METALLIC_MATERIAL:
                rayHitMetallicSurface(res, ray, color);
                break;
            case LAMBERTIAN_MATERIAL:
                rayHitLambertianSurface(res, ray, color);
                break;
            case DIELECTRIC_MATERIAL:
                rayHitDielectricSurface(res, ray, color);
                break;
            }
        } else {
            float t = (1.0 + normalize(ray.dir).z) * 0.5;
            color *= t * vec3(1.0, 1.0, 1.0) + (1.0 - t) * vec3(0.5, 0.7, 1.0);
            break; // out of for loop
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
    r.origin = vec3(0.0, 0.0, 0.0);
    vec3 sum = vec3(0.0, 0.0, 0.0);

    for (int i = 0; i < u_num_samples; ++i) {
        r.dir = vec3(v_eye_to_x + rand(), 
                     u_eye_to_y, 
                     v_eye_to_z + rand()
                     );
        r.dir = normalize(r.dir);

        sum += castPrimaryRay(r, EPSILON, MAX_FLT);
    }

    o_color = vec4(sum / float(u_num_samples), 1.0);
}
