#version 300 es
precision highp int;
precision highp float;

// structures
//
struct Ray {
    vec3 origin; // ray origin
    vec3 dir;    // ray direction
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
    vec4  albedo;
    float shininess;
    float refractionIndex;
    int   materialClass;
};

struct BV { // AABB bounding volume
    vec4 min; // min corner
    vec4 max; // max corner
    int  lt; // l BV node
    int  rt; // r BV node
    int  f0; // face index
    int  f1; // face index
};

struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialIndex;
};

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
uniform highp sampler2D  u_colorCache;
uniform highp usampler2D u_noiseCache;
uniform int u_render_pass;
uniform int u_num_samples;
uniform int u_num_bounces;

uniform float u_eye_to_image; // distance to image plane from eye
uniform vec3  u_eye_position; // eye position in world space
uniform mat4  u_eye_to_world; // eye to world space matrix (BVH, rays and triangles are all in world space)

layout (std140) uniform uniform_block_tri {
    Tri u_tri[MAX_TRI_COUNT]; // indices into u_pos and u_nrm
};

layout (std140) uniform uniform_block_pos {
    vec3 u_pos[MAX_POS_COUNT]; // in world space
};

layout (std140) uniform uniform_block_nrm {
    vec4 u_nrm[MAX_NRM_COUNT]; // in world space (w component holds plane equation value D for face normals)
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
layout (location = 0) out vec4 o_colorCache;

// ----------------------------------------------------------------------------
// globals
//
uvec4 g_randGeneratorState;

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
    g_randGeneratorState.x = tauswortheGenerator(g_randGeneratorState.x, 13, 19, 12, 4294967294u); // p1=2^31-1
    g_randGeneratorState.y = tauswortheGenerator(g_randGeneratorState.y, 2,  25, 4,  4294967288u); // p2=2^30-1
    g_randGeneratorState.z = tauswortheGenerator(g_randGeneratorState.z, 3,  11, 17, 4294967280u); // p3=2^28-1
    g_randGeneratorState.w = linearCongruentialGenerator(g_randGeneratorState.w, 1664525u, 1013904223u); // p4=2^32

    // Combined period is lcm(p1,p2,p3,p4) ~ 2^121
    return 2.3283064365387e-10 * float(g_randGeneratorState.x ^ g_randGeneratorState.y ^ g_randGeneratorState.z ^ g_randGeneratorState.w);
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
    vec3 n = u_nrm[f.fn].xyz;

    float n_dot_ray_dir = dot(n, r.dir);
    if (abs(n_dot_ray_dir) < EPSILON) {
        return false; // face normal and ray direction almost perpendicular
    }

    float t = (u_nrm[f.fn].w - dot(n, r.origin)) / n_dot_ray_dir; // a(ox + t*dx) + b(oy + t*dy) + c(oz + t*dz) - d = 0 (solve for t)

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
    res.n = normalize((u * u_nrm[f.n0].xyz) + (v * u_nrm[f.n1]).xyz + ((1.0 - u - v) * u_nrm[f.n2]).xyz); // interpolate using barycentric coordinates
    res.f = f.fn;
    res.m = f.mi;

    return true;
}

bool rayIntersectBV(Ray r, BV bv) { // slabs method using intrinsics
    vec3 t0 = (bv.min.xyz - r.origin) / r.dir;
    vec3 t1 = (bv.max.xyz - r.origin) / r.dir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float max_tmin = max(tmin.x, max(tmin.y, tmin.z));
    float min_tmax = min(tmax.x, min(tmax.y, tmax.z));

    return max_tmin < min_tmax && max_tmin > 0.0; // no intersection if behind ray origin
}

bool rayIntersectBVH(Ray r, out RayHitResult nearest) {
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
}

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

/*
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

    ray.origin = res.p + u_nrm[res.f].xyz * EPSILON;
    ray.dir    = normalize(reflect(ray.dir, res.n) + (1.0 - metallic.shininess) * randPosInUnitSphere());

    if (dot(ray.dir, res.n) > 0.0) {
        color *= metallic.albedo.rgb;
    } else {
        color = vec3(0.0, 0.0, 0.0);
    }
}

void rayHitLambertianSurface(RayHitResult res, inout Ray ray, inout vec3 color) {
    Mat lambertian = u_mat[res.m];

    ray.origin = res.p + u_nrm[res.f].xyz * EPSILON;
    ray.dir = normalize(ray.origin + res.n + randPosInUnitSphere() - res.p);
    color *= lambertian.albedo.rgb;
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
        face_n = +u_nrm[res.f].xyz;
    } else { // from object into air
        refractiveRatio = dielectric.refractionIndex;
        normal = -res.n;
        face_n = -u_nrm[res.f].xyz;
    }

    refraction = refract(ray.dir, normal, refractiveRatio);
    if (dot(refraction, refraction) > 0.0) {
        ray.origin = res.p - EPSILON * face_n;
        ray.dir    = refraction;
    } else {
        ray.origin = res.p + EPSILON * u_nrm[res.f].xyz;
        ray.dir    = reflect(ray.dir, res.n);
    }

    color *= dielectric.albedo.rgb;
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
            color  *= (1.0 - t) * vec3(1.0, 1.0, 1.0) + t * vec3(0.5, 0.7, 1.0);
            break; // out of for loop
        }
    }

    return color;
}

// ----------------------------------------------------------------------------
// main
//
void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);

    // must restore random number generator state 1st before using rand()
    g_randGeneratorState = texelFetch(u_noiseCache, fragCoord, 0) + uvec4(u_render_pass, u_render_pass, u_render_pass, u_render_pass);

    vec4 rayTarget = u_eye_to_world * vec4( // from view space to world space
        v_eye_to_x + rand(), 
        u_eye_to_image, 
        v_eye_to_z + rand(), 
        1.0
    );

    Ray ray = Ray(u_eye_position, normalize(rayTarget.xyz - u_eye_position));

    if (u_render_pass > 1) {
        o_colorCache = vec4(castPrimaryRay(ray), 0.0) + texelFetch(u_colorCache, fragCoord, 0);
    } else {
        o_colorCache = vec4(castPrimaryRay(ray), 1.0);
    }
}
