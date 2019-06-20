#version 300 es
precision highp int;
precision highp float;

// ----------------------------------------------------------------------------
// structures
//
struct Ray {
    vec3 origin; // ray origin
    vec3 dir;    // ray direction
    vec3 inv;    // inverse ray direction
};

struct RayHitResult {
    float t; // contact point ray scalar
    vec3  p; // contact point
    vec3  n; // contact normal
    int   f; // face normal index
    int   m; // contact material index
};

struct Tri { // sizeof = 32 bytes
    int p0; // vertex 0 position index (base 4, alignment 0)
    int p1; // vertex 1 position index (base 4, alignment 4)
    int p2; // vertex 2 position index (base 4, alignment 8)
    int n0; // vertex 0 normal index (base 4, alignment 12)
    int n1; // vertex 1 normal index (base 4, alignment 16)
    int n2; // vertex 2 normal index (base 4, alignment 20)
    int fn; // face normal index (base 4, alignment 24)
    int mi; // material index (base 4, alignment 28)
};

struct Mat {
    vec3  albedo;
    float shininess;
    float refractionIndex;
    int   materialClass;
};

struct BV { // AABB bounding volume
    vec3 min; // min corner
    vec3 max; // max corner
    int  lt; // l BV node
    int  rt; // r BV node
    int  f0; // face index
    int  f1; // face index
};

/*
struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialIndex;
};
*/

// ----------------------------------------------------------------------------
// constants
//
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.01;

const int MAX_MAT_COUNT = 8;
const int METALLIC_MATERIAL   = 0;
const int LAMBERTIAN_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int MAX_TRI_COUNT = 1024;
const int MAX_POS_COUNT = MAX_TRI_COUNT * 3;
const int MAX_NRM_COUNT = MAX_TRI_COUNT * 3 + MAX_TRI_COUNT;

const int MAX_BV_COUNT      = MAX_TRI_COUNT + 1;
const int MAX_BV_STACK_SIZE = 16;

// ----------------------------------------------------------------------------
// uniforms
//
uniform highp usampler2D u_rndSampler;
uniform int u_num_samples;
uniform int u_num_bounces;

uniform mat4  u_eye_to_world; // eye to world space matrix (BVH, rays and triangles are all in world space)
uniform float u_eye_to_image; // distance to image plane from eye
uniform vec3  u_eye_position; // eye position in world space

layout (std140) uniform uniform_block_tri {
    Tri u_tri[MAX_TRI_COUNT]; // indices into u_pos and u_nrm
};

layout (std140) uniform uniform_block_pos {
    vec3 u_pos[MAX_POS_COUNT]; // in world space
};

layout (std140) uniform uniform_block_nrm {
    vec3 u_nrm[MAX_NRM_COUNT]; // in world space
};

layout (std140) uniform uniform_block_mat {
    Mat u_mat[MAX_MAT_COUNT];
};

layout (std140) uniform uniform_block_bvh {
    BV u_bv[MAX_BV_COUNT];
};

// ----------------------------------------------------------------------------
// varyings
//
in float v_eye_to_x;
in float v_eye_to_z;

// ----------------------------------------------------------------------------
// outputs
//
out vec4 o_color;

// ----------------------------------------------------------------------------
// globals
//
uvec4 g_generatorState;

// ----------------------------------------------------------------------------
// randomness
//
uint tauswortheGenerator(uint z, int S1, int S2, int S3, uint M) {
    return ((z & M) << S3) ^ (((z << S1) ^ z) >> S2);
}

uint linearCongruentialGenerator(uint z, uint A, uint C) {
  return A * z + C;
}

float rand() {
    g_generatorState.x = tauswortheGenerator(g_generatorState.x, 13, 19, 12, 4294967294u); // p1=2^31-1
    g_generatorState.y = tauswortheGenerator(g_generatorState.y, 2,  25, 4,  4294967288u); // p2=2^30-1
    g_generatorState.z = tauswortheGenerator(g_generatorState.z, 3,  11, 17, 4294967280u); // p3=2^28-1
    g_generatorState.w = linearCongruentialGenerator(g_generatorState.w, 1664525u, 1013904223u); // p4=2^32

    // Combined period is lcm(p1,p2,p3,p4) ~ 2^121
    return 2.3283064365387e-10 * float(g_generatorState.x ^ g_generatorState.y ^ g_generatorState.z ^ g_generatorState.w);
}

vec3 randPosInUnitSphere() {
    vec3 p;
    do 
    { p = 2.0 * vec3(rand(), rand(), rand()) + vec3(-1.0, -1.0, -1.0);
    } while (dot(p, p) > 1.0);

    return p;
}

// ----------------------------------------------------------------------------
// ray intersect objects
//
bool rayIntersectTri(Ray r, Tri f, out RayHitResult res) {
    vec3 n = u_nrm[f.fn];

    float n_dot_ray_dir = dot(n, r.dir);
    if (abs(n_dot_ray_dir) < EPSILON) {
        return false; // face normal and ray direction almost perpendicular
    }

    float d = dot(n, u_pos[f.p0]); // ax + by + cz - d = 0 (solve for d)
    float t = (d - dot(n, r.origin)) / n_dot_ray_dir; // a(ox + t*dx) + b(oy + t*dy) + c(oz + t*dz) - d = 0 (solve for t)

    if (t < EPSILON) return false; // contact point behind ray
    vec3 p = r.origin + t * r.dir; // contact point on plane 

    float u = dot(n, cross(u_pos[f.p2] - u_pos[f.p1], p - u_pos[f.p1]));
    if (u < 0.0) return false; // contact point on right hand side of p1 -> p2

    float v = dot(n, cross(u_pos[f.p0] - u_pos[f.p2], p - u_pos[f.p2]));
    if (v < 0.0) return false; // contact point on right hand side of p2 -> p0

    float w = dot(n, cross(u_pos[f.p1] - u_pos[f.p0], p - u_pos[f.p0])); 
    if (w < 0.0) return false; // contact point on right hand side of p0 -> p1

    float inv_n_dot_n = 1.0 / dot(n, n);
    u *= inv_n_dot_n;
    v *= inv_n_dot_n;

    res.t = t;
    res.p = p;
    res.n = normalize((u * u_nrm[f.n0]) + (v * u_nrm[f.n1]) + ((1.0 - u - v) * u_nrm[f.n2])); // interpolate using barycentric coordinates
    res.f = f.fn;
    res.m = f.mi;

    return true;
}

bool rayIntersectBV(Ray r, BV bv) { // slabs method using intrinsics
    vec3 t0 = (bv.min - r.origin) * r.inv;
    vec3 t1 = (bv.max - r.origin) * r.inv;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float max_tmin = max(tmin.x, max(tmin.y, tmin.z));
    float min_tmax = min(tmax.x, min(tmax.y, tmax.z));

    return max_tmin < min_tmax && max_tmin > 0.0; // no intersection if behind ray origin
}

bool rayIntersectBVH(Ray r, out RayHitResult nearest) {
    /*
    int stack[MAX_BV_STACK_SIZE];
    int i = 0;

    RayHitResult current;
    BV bv;

    nearest.t = MAX_FLT;
    stack[0]  = 0; // push root BV on to stack

    while (i > -1) {
        bv = u_bv[stack[i--]]; // pop BV off top of stack

        if (rayIntersectBV(r, bv)) {
            if (bv.lt != -1) { stack[++i] = bv.lt; } // push l BV node on to stack
            if (bv.rt != -1) { stack[++i] = bv.rt; } // push r BV node on to stack

            if (bv.f0 != -1 && rayIntersectTri(r, u_tri[bv.f0], current) && current.t < nearest.t) {
                nearest = current;
            }
            if (bv.f1 != -1 && rayIntersectTri(r, u_tri[bv.f1], current) && current.t < nearest.t) {
                nearest = current;
            }
        }
    }

    return nearest.t != MAX_FLT;
    */

    RayHitResult current;
    bool contact = false;

    for (int i = 0; i < 100; ++i) {
        if (rayIntersectTri(r, u_tri[i], current)) {
            if (!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}

/*
bool rayIntersectSphere(Ray r, Sphere s, out RayHitResult res) {
    vec3  l = r.origin - s.center;
    float a = dot(r.dir, r.dir);
    float b = dot(r.dir, l);
    float c = dot(l, l) - s.radiusSquared;

    float discriminant = (b * b) - (a * c);
    if (discriminant > 0.0) {
        float sq = sqrt(discriminant);
        float t;

        t = (-b - sq) / a;
        if (t > 0.0) {
            res.t = t;
            res.p = r.origin + r.dir * t;
            res.n = (res.p - s.center) / s.radius;
            res.m = s.materialIndex;
            return true;
        }
        t = (-b + sq) / a;
        if (t > 0.0) {
            res.t = t;
            res.p = r.origin + r.dir * t;
            res.n = (res.p - s.center) / s.radius;
            res.m = s.materialIndex;
            return true;
        }
    }
    return false;
}

bool rayIntersectNearestSphere(Ray r, out RayHitResult nearest) {
    RayHitResult current;
    bool contact = false;

    for (int i = 0; i < u_num_spheres; ++i) {
        if (rayIntersectSphere(r, u_spheres[i], current)) {
            if (!contact || current.t < nearest.t) {
                nearest = current;
                contact = true;
            }
        }
    }
    return contact;
}
*/

// ----------------------------------------------------------------------------
// ray cast from eye through pixel
//
float schlick(float cosine, float rindex) {
    float r0 = (1.0 - rindex) / (1.0 + rindex);
    r0 *= r0;
    
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayHitMetallicSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Mat metallic = u_mat[res.m];

    ray.origin = res.p + u_nrm[res.f] * EPSILON;
    ray.dir    = normalize(reflect(ray.dir, res.n) + (1.0 - metallic.shininess) * randPosInUnitSphere());
    ray.inv    = 1.0 / ray.dir;

    if (dot(ray.dir, res.n) > 0.0) {
        color *= metallic.albedo;
    } else {
        color = vec3(0.0, 0.0, 0.0);
    }
}

void rayHitLambertianSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Mat lambertian = u_mat[res.m];

    ray.origin = res.p + u_nrm[res.f] * EPSILON;
    ray.dir    = normalize(ray.origin + res.n + randPosInUnitSphere() - res.p);
    ray.inv    = 1.0 / ray.dir;

    color *= lambertian.albedo;
}

void rayHitDielectricSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Mat dielectric = u_mat[res.m];
    float refractiveRatio;
    vec3  refraction;
    vec3  normal;
    vec3  face_n;

    if (dot(ray.dir, res.n) < 0.0) { // into object from air
        refractiveRatio = 1.0 / dielectric.refractionIndex;
        normal = +res.n;
        face_n = +u_nrm[res.f];
    } else { // from object into air
        refractiveRatio = dielectric.refractionIndex;
        normal = -res.n;
        face_n = -u_nrm[res.f];
    }

    refraction = refract(ray.dir, normal, refractiveRatio);
    if (dot(refraction, refraction) > 0.0) {
        ray.origin = res.p - EPSILON * face_n;
        ray.dir    = refraction;
        ray.inv    = 1.0 / ray.dir;
    } else {
        ray.origin = res.p + EPSILON * u_nrm[res.f];
        ray.dir    = reflect(ray.dir, res.n);
        ray.inv    = 1.0 / ray.dir;
    }

    color *= dielectric.albedo;
}

vec3 castPrimaryRay(Ray ray) {
    vec3 color = vec3(1.0, 1.0, 1.0);
    RayHitResult res;

    for (int i = 0; i <= u_num_bounces; ++i) {
        if (rayIntersectBVH(ray, res)) {
            switch (u_mat[res.m].materialClass) {
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
            color *=  (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
            break; // out of for loop
        }
    }

    return color;
}

// ----------------------------------------------------------------------------
// main
//
void main() {
    // must initialize random number generator state before using rand()
    g_generatorState = texelFetch(u_rndSampler, ivec2(gl_FragCoord.xy), 0);

    Ray r;
    r.origin = u_eye_position;
    vec3 sum = vec3(0.0, 0.0, 0.0);
    vec4 p; // world space pos

    for (int i = 0; i < u_num_samples; ++i) {
        p = u_eye_to_world * vec4(v_eye_to_x + rand(), u_eye_to_image, v_eye_to_z + rand(), 1.0);
        r.dir = normalize(p.xyz - u_eye_position);
        r.inv = 1.0 / r.dir;

        sum += castPrimaryRay(r);
    }

    o_color = vec4(sum / float(u_num_samples), 1.0);
    /*
    if (u_mat[0].albedo.x > 0.8 && u_mat[0].albedo.x < 1.0)
        o_color = vec4(0.0, 1.0, 0.0, 1.0);
    else
        o_color = vec4(1.0, 0.0, 0.0, 1.0);
    */
}
