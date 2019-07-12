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
    vec3  fn; // contact face normal
    vec3  p; // contact point
    vec3  n; // contact normal
    float t; // ray origin to contact point distance
    float u; // barycentric coordinate for vertex 0
    float v; // barycentric coordinate for vertex 1
    float w; // barycentric coordinate for vertex 2
    int mi; // material index
    int fi; // face index
    int oi; // obj index
};

/*
struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialIndex;
};
*/

struct Mtl {
    int   mtlCls;
    vec3  albedo;
    float reflectionRatio;
    float reflectionGloss;
    float refractionIndex;
};

// ----------------------------------------------------------------------------
// constants
//
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.001;

const int FLAT_SHADING = 0;

const int EMISSIVE_MATERIAL   = 0;
const int REFLECTIVE_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int BV_MAX_STACK_SIZE = 16;
const int BV_MIN_BOUNDS_INDEX = 0;
const int BV_MAX_BOUNDS_INDEX = 1;
const int BV_PAYLOAD_INDEX = 2;

const int FACE_NRM_INDEX = 0;
const int VERTEX_0_POS_INDEX = 1;
const int VERTEX_1_POS_INDEX = 2;
const int VERTEX_2_POS_INDEX = 3;
const int VERTEX_0_NRM_INDEX = 4;
const int VERTEX_1_NRM_INDEX = 5;
const int VERTEX_2_NRM_INDEX = 6;
const int FACE_MTL_INDEX = 7;

const int MTL_ALBEDO_INDEX = 0;
const int MTL_ATTRIB_INDEX = 1;

const int RAY_BOUNCE_MAX_STACK_SIZE = 16;

// ----------------------------------------------------------------------------
// varyings
//
in float v_eye_to_x;
in float v_eye_to_z;

// ----------------------------------------------------------------------------
// outputs
//
layout (location = 0) out vec4 o_color; // texture unit 0, COLOR_ATTACHMENT0

// ----------------------------------------------------------------------------
// uniforms
//
uniform highp sampler2D u_color_sampler; // texture unit 1
uniform highp usampler2D u_random_sampler; // texture unit 2
uniform highp sampler2DArray u_face_sampler; // texture unit 3
uniform highp sampler2DArray u_aabb_sampler; // texture unit 4
uniform highp sampler2D u_mtl_sampler; // texture unit 5

uniform int u_num_objects; // number of models/objects to render
uniform int u_render_pass; // current render pass number
uniform int u_num_bounces; // max number of ray bounces
uniform int u_shadingMethod; // flat or Phong shading

uniform float u_eye_to_image; // y axis distance to image plane from eye in view space
uniform vec3  u_eye_position; // eye position in world space
uniform mat4  u_eye_to_world; // eye to world space matrix (BVH, rays and triangles are all stored in world space)

// ----------------------------------------------------------------------------
// globals
//
uvec4 g_randGeneratorState; // random number generator current state

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
bool rayIntersectFace(Ray r, int face_index, int obj_index, out RayHitResult res) {
    res.fn = texelFetch(u_face_sampler, ivec3(FACE_NRM_INDEX, face_index, obj_index), 0).xyz; // face normal

    float fn_dot_ray_dir = dot(res.fn, r.dir);
    if (abs(fn_dot_ray_dir) < EPSILON) {
        return false; // ray direction almost parallel
    }

    vec3 p0 = texelFetch(u_face_sampler, ivec3(VERTEX_0_POS_INDEX, face_index, obj_index), 0).xyz; // vertex 0 position

    // A(origin.x + t*dir.x) + B(origin.y + t*dir.y) + C(origin.z + t*dir.z) - D = 0 (solve for t)
    res.t = (dot(res.fn, p0) - dot(res.fn, r.origin)) / fn_dot_ray_dir;
    if (res.t < EPSILON) return false; // contact point behind ray

    res.p = r.origin + res.t * r.dir; // contact point on plane
    vec3 p1 = texelFetch(u_face_sampler, ivec3(VERTEX_1_POS_INDEX, face_index, obj_index), 0).xyz; // vertex 1 position
    vec3 p2 = texelFetch(u_face_sampler, ivec3(VERTEX_2_POS_INDEX, face_index, obj_index), 0).xyz; // vertex 2 position

    // from Real-Time Collision Detection (Morgan Kaufman) by Christer Ericson
    vec3 v0 = p1 - p0;
    vec3 v1 = p2 - p0;
    vec3 v2 = res.p - p0;
    float d00 = dot(v0, v0);
    float d01 = dot(v0, v1);
    float d11 = dot(v1, v1);
    float d20 = dot(v2, v0);
    float d21 = dot(v2, v1);
    float denominator = (d00 * d11) - (d01 * d01);

    res.v = (d11 * d20 - d01 * d21) / denominator;
    if (res.v < 0.0 || res.v > 1.0) return false;

    res.w = (d00 * d21 - d01 * d20) / denominator;
    if (res.w < 0.0 || res.w > 1.0) return false;

    res.u = 1.0 - res.v - res.w;
    if (res.u < 0.0 || res.u > 1.0) return false;

    res.fi = face_index;
    res.oi = obj_index;
    return true;
}

bool rayIntersectBV(Ray r, vec3 bvMin, vec3 bvMax) { // ray intersect AABB slabs method sped up using intrinsics
    vec3 t0 = (bvMin - r.origin) / r.dir;
    vec3 t1 = (bvMax - r.origin) / r.dir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float max_tmin = max(tmin.x, max(tmin.y, tmin.z));
    float min_tmax = min(tmax.x, min(tmax.y, tmax.z));

    return max_tmin < min_tmax;
}

bool rayIntersectBVH(Ray r, out RayHitResult nearest) {
    int stack[BV_MAX_STACK_SIZE];
    RayHitResult current;
    vec4 texel;

    int lt_idx, rt_idx;
    int f0_idx, f1_idx;
    int bv_idx;
    int top;

    nearest.t = MAX_FLT;

    for (int obj_idx = 0; obj_idx < u_num_objects; ++obj_idx) { // for each mesh object/BVH tree
        stack[0] = 0; // push root BV index which is always 0 on to empty stack
        top = 0;

        while (top > -1) {
            bv_idx = stack[top--]; // pop BV index from top of stack
            if (rayIntersectBV(r,
                texelFetch(u_aabb_sampler, ivec3(BV_MIN_BOUNDS_INDEX, bv_idx, obj_idx), 0).xyz,// BV AABB min bounds
                texelFetch(u_aabb_sampler, ivec3(BV_MAX_BOUNDS_INDEX, bv_idx, obj_idx), 0).xyz // BV AABB max bounds
            )) {
                texel = texelFetch(u_aabb_sampler, ivec3(BV_PAYLOAD_INDEX, bv_idx, obj_idx), 0);
                lt_idx = int(texel.r); // index of L child BV node
                rt_idx = int(texel.g); // index of R child BV node
                f0_idx = int(texel.b); // index of a face inside current BV bounds
                f1_idx = int(texel.a); // index of a face inside current BV bounds

                if (lt_idx != -1) { stack[++top] = lt_idx; } // push lt BV index on to stack
                if (rt_idx != -1) { stack[++top] = rt_idx; } // push rt BV index on to stack

                if (f0_idx != -1 && rayIntersectFace(r, f0_idx, obj_idx, current) && current.t < nearest.t) {
                    nearest = current;
                }
                if (f1_idx != -1 && rayIntersectFace(r, f1_idx, obj_idx, current) && current.t < nearest.t) {
                    nearest = current;
                }
            }
        }
    }

    if (nearest.t != MAX_FLT) { // ray has a nearest hit
        if (u_shadingMethod == FLAT_SHADING) { // use the face normal for flat shading
            nearest.n = nearest.fn;
        } else { // interpolate vertex normals using barycentric coordinates to implement Phong shading
            float u = nearest.u;
            float v = nearest.v;
            float w = 1.0 - u - v;
            int obj_index = nearest.oi;
            int face_index = nearest.fi;
            nearest.n = normalize(
                (texelFetch(u_face_sampler, ivec3(VERTEX_0_NRM_INDEX, face_index, obj_index), 0).xyz * u) +
                (texelFetch(u_face_sampler, ivec3(VERTEX_1_NRM_INDEX, face_index, obj_index), 0).xyz * v) +
                (texelFetch(u_face_sampler, ivec3(VERTEX_2_NRM_INDEX, face_index, obj_index), 0).xyz * w)
            );
        }
        nearest.mi = int(texelFetch(u_face_sampler, ivec3(FACE_MTL_INDEX, nearest.fi, nearest.oi), 0).x); // material index
        return true;
    }
    return false;
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
// ray cast from eye through image pixel
//
float schlick(float cosine, float rindex) {
    float  r0 = (1.0 - rindex) / (1.0 + rindex); r0 *= r0;
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayBounceOffReflectiveSurface(inout Ray ray, RayHitResult res, Mtl mtl) {
    ray.origin = res.p + res.fn * EPSILON;
    if (rand() < mtl.reflectionRatio) {
        ray.dir = normalize(reflect(ray.dir, res.n) + (1.0 - mtl.reflectionGloss) * randPosInUnitSphere());
    } else {
        ray.dir = normalize(res.p + res.n + randPosInUnitSphere() - res.p);
    }
}

void rayBounceOffDielectricSurface(inout Ray ray, RayHitResult res, Mtl mtl) {
    float refractionRatio;
    float reflectionProb;
    float cosine;
    vec3  refraction;
    vec3  n;

    if (dot(ray.dir, res.n) < 0.0) { // into liquid/solid from air
        refractionRatio = 1.0 / mtl.refractionIndex;
        n  = +res.n;
        cosine = -dot(ray.dir, res.n);
    } else { // from object into air
        refractionRatio = mtl.refractionIndex;
        n  = -res.n;
        cosine =  dot(ray.dir, res.n) * mtl.refractionIndex;
    }

    refraction = refract(ray.dir, n, refractionRatio);
    if (dot(refraction, refraction) > 0.0) {
        reflectionProb = schlick(cosine, mtl.refractionIndex);
    } else {
        reflectionProb = 1.0;
    }

    if (rand() < reflectionProb) { // reflected ray
        ray.origin = res.p + EPSILON * n;
        ray.dir    = reflect(ray.dir, res.n);
    } else { // refracted ray
        ray.origin = res.p - EPSILON * n;
        ray.dir    = refraction;
    }
}

vec3 pathTrace(Ray ray) {
    RayHitResult hitStack[RAY_BOUNCE_MAX_STACK_SIZE];
    Mtl          mtlStack[RAY_BOUNCE_MAX_STACK_SIZE];
    vec3 color = vec3(0.0, 0.0, 0.0);
    vec4 texel;
    bool bLoop = true;
    int  i = 0;

    while (bLoop && rayIntersectBVH(ray, hitStack[i])) {
        mtlStack[i].albedo = texelFetch(u_mtl_sampler, ivec2(MTL_ALBEDO_INDEX, hitStack[i].mi), 0).xyz;
        texel              = texelFetch(u_mtl_sampler, ivec2(MTL_ATTRIB_INDEX, hitStack[i].mi), 0);
        mtlStack[i].mtlCls = int(texel.x);
        mtlStack[i].reflectionRatio = texel.y;
        mtlStack[i].reflectionGloss = texel.z;
        mtlStack[i].refractionIndex = texel.w;

        switch (mtlStack[i].mtlCls) {
        case EMISSIVE_MATERIAL:
            color = mtlStack[i].albedo;
            bLoop = false;
            break;

        case REFLECTIVE_MATERIAL:
            if (i < u_num_bounces) {
                rayBounceOffReflectiveSurface(ray, hitStack[i], mtlStack[i]);
                if (dot(ray.dir, hitStack[i].n) < 0.0) { // absorb ray
                    color = vec3(0.0, 0.0, 0.0);
                    bLoop = false;
                    i=0;
                } else {
                    i++;
                }
            } else {
                color = mtlStack[i].albedo;
                bLoop = false;
            }
            break;

        case DIELECTRIC_MATERIAL:
            if (i < u_num_bounces) {
                rayBounceOffDielectricSurface(ray, hitStack[i], mtlStack[i]); ++i;
            } else {
                color = mtlStack[i].albedo;
                bLoop = false;
            }
            break;
        }
    }

    while (i > 0) {
        color *= mtlStack[--i].albedo;
    }

    return color;
}

// ----------------------------------------------------------------------------
// main
//
void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);

    // seed the random number generator before using rand(), use render pass number to change the seed for every pass
    g_randGeneratorState = texelFetch(u_random_sampler, fragCoord, 0)
                            + uvec4(u_render_pass, u_render_pass, u_render_pass, u_render_pass);

    vec4 rayTarget = u_eye_to_world * vec4( // transform ray target pos on image plane from view space to world space
        v_eye_to_x + rand(),
        u_eye_to_image,
        v_eye_to_z + rand(),
        1.0
    );

    Ray ray = Ray(u_eye_position, normalize(rayTarget.xyz - u_eye_position));
    if (u_render_pass == 1) { // o_color is a RGBAF32 texture render target
        o_color = vec4(pathTrace(ray), 1.0); // very 1st render pass (initialize RGBAF32 texture render target)
    } else { // add sample color into RGBA32F texture render target
        o_color = vec4(pathTrace(ray), 0.0) + texelFetch(u_color_sampler, fragCoord, 0);
    }

    /*
    vec3 texel = texelFetch(u_mtl_sampler, ivec2(MTL_ATTRIB_INDEX, 0), 0).xyz;
    if (texel.z == 1.0) o_color = vec4(0.0, 1.0, 0.0, 1.0); else o_color = vec4(1.0, 0.0, 0.0, 1.0);
    */
}
