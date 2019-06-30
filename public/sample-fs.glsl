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
    int mi; // material id
    int id; // face id
};

struct Sphere {
    vec3  center;
    float radius;
    float radiusSquared;
    int   materialIndex;
};

struct Mat {
    vec3  albedo;
    float shininess;
    float refractionIndex;
    int   materialClass;
};

// ----------------------------------------------------------------------------
// constants
//
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.001;

const int FLAT_SHADING = 0;

const int METALLIC_MATERIAL   = 0;
const int LAMBERTIAN_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int MAX_BV_STACK_SIZE = 16;

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
uniform highp sampler2D  u_color_sampler; // texture unit 1
uniform highp usampler2D u_noise_sampler; // texture unit 2
uniform highp sampler2D  u_face_sampler; // texture unit 3
uniform highp sampler2D  u_bvh_sampler; // texture unit 4
uniform highp sampler2D  u_mat_sampler; // texture unit 5

uniform int u_render_pass; // current render pass number
uniform int u_num_bounces; // max number of ray bounces
uniform int u_shading; // flat or Gouraud shading

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
bool rayIntersectFace(Ray r, int id, out RayHitResult res) {
    res.fn = texelFetch(u_face_sampler, ivec2(0, id), 0).xyz; // face normal

    float fn_dot_ray_dir = dot(res.fn, r.dir);
    if (fn_dot_ray_dir > 0.0 || abs(fn_dot_ray_dir) < EPSILON) {
        return false; // back facing or face and ray direction almost parallel
    }

    vec3 p0 = texelFetch(u_face_sampler, ivec2(1, id), 0).xyz; // vertex 0 position

    // A(origin.x + t*dir.x) + B(origin.y + t*dir.y) + C(origin.z + t*dir.z) - D = 0 (solve for t)
    res.t = (dot(res.fn, p0) - dot(res.fn, r.origin)) / fn_dot_ray_dir;
    if (res.t < EPSILON) return false; // contact point behind ray

    res.p = r.origin + res.t * r.dir; // contact point on plane
    vec3 p1 = texelFetch(u_face_sampler, ivec2(2, id), 0).xyz; // vertex 1 position
    vec3 p2 = texelFetch(u_face_sampler, ivec2(3, id), 0).xyz; // vertex 2 position

    // from Real-Time Collision Detection by Christer Ericson
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

    res.id = id; // face id
    return true;
}

bool rayIntersectBV(Ray r, vec3 bvMin, vec3 bvMax) { // ray intersect AABB slabs method sped up using intrinsics
    vec3 t0 = (bvMin - r.origin) / r.dir;
    vec3 t1 = (bvMax - r.origin) / r.dir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    float max_tmin = max(tmin.x, max(tmin.y, tmin.z));
    float min_tmax = min(tmax.x, min(tmax.y, tmax.z));

    return max_tmin < min_tmax
        && max_tmin > 0.0; // no intersection if behind ray origin
}

bool rayIntersectBVH(Ray r, out RayHitResult nearest) {
    RayHitResult current;
    vec4 texel;
    int lt, rt;
    int f0, f1;
    int id;

    int stack[MAX_BV_STACK_SIZE];
    stack[0] = 0; // root BV id is always 0
    int top = 0;

    nearest.t = MAX_FLT;
    while (top > -1) {
        id = stack[top--]; // Pop BVH id from top of stack
        if (rayIntersectBV( r,
                            texelFetch(u_bvh_sampler, ivec2(0, id), 0).xyz,// min bounds
                            texelFetch(u_bvh_sampler, ivec2(1, id), 0).xyz // max bounds
                            )) {
            texel = texelFetch(u_bvh_sampler, ivec2(2, id), 0);
            lt = int(texel.r);
            rt = int(texel.g);
            f0 = int(texel.b);
            f1 = int(texel.a);

            if (lt != -1) { stack[++top] = lt; } // push lt BV id on to stack
            if (rt != -1) { stack[++top] = rt; } // push rt BV id on to stack

            if (f0 != -1 && rayIntersectFace(r, f0, current) && current.t < nearest.t) {
                nearest = current;
            }
            if (f1 != -1 && rayIntersectFace(r, f1, current) && current.t < nearest.t) {
                nearest = current;
            }
        }
    }

    if (nearest.t != MAX_FLT) {
        if (u_shading == FLAT_SHADING) { // use the face normal for flat shading
            nearest.n = nearest.fn;
        } else { // interpolate using barycentric coordinates to implement Gouraud shading
            nearest.n  = normalize( (texelFetch(u_face_sampler, ivec2(4, nearest.id), 0).xyz * nearest.u) +
                                    (texelFetch(u_face_sampler, ivec2(5, nearest.id), 0).xyz * nearest.v) +
                                    (texelFetch(u_face_sampler, ivec2(6, nearest.id), 0).xyz * (1.0 - nearest.u - nearest.v))
                                    );
        }
        nearest.mi = int(texelFetch(u_face_sampler, ivec2(7, nearest.id), 0).x); // material index
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
    float r0 = (1.0 - rindex) / (1.0 + rindex);
    r0 *= r0;

    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayHitMetallicSurface(RayHitResult res, Mat metallic, inout Ray ray, inout vec3 color) {
    ray.origin = res.p + res.fn * EPSILON;
    ray.dir    = normalize(reflect(ray.dir, res.n) + (1.0 - metallic.shininess) * randPosInUnitSphere());

    if (dot(ray.dir, res.n) > 0.0) {
        color *= metallic.albedo.rgb;
    } else {
        color = vec3(0.0, 0.0, 0.0);
    }
}

void rayHitLambertianSurface(RayHitResult res, Mat lambertian, inout Ray ray, inout vec3 color) {
    ray.origin = res.p + res.fn * EPSILON;
    ray.dir = normalize(res.p + res.n + randPosInUnitSphere() - res.p);
    color *= lambertian.albedo.rgb;
}

void rayHitDielectricSurface(RayHitResult res, Mat dielectric, inout Ray ray, inout vec3 color) {
    float refractiveRatio;
    vec3  refraction;
    vec3  normal;
    vec3  face_n;

    if (dot(ray.dir, res.n) < 0.0) { // into object from air
        refractiveRatio = 1.0 / dielectric.refractionIndex;
        normal = +res.n;
        face_n = +res.fn;
    } else { // from object into air
        refractiveRatio = dielectric.refractionIndex;
        normal = -res.n;
        face_n = -res.fn;
    }

    refraction = refract(ray.dir, normal, refractiveRatio);
    if (dot(refraction, refraction) > 0.0) {
        ray.origin = res.p - EPSILON * face_n;
        ray.dir    = refraction;
    } else {
        ray.origin = res.p + EPSILON * res.fn;
        ray.dir    = reflect(ray.dir, res.n);
    }

    color *= dielectric.albedo.rgb;
}

vec3 castPrimaryRay(Ray ray) {
    vec3 color = vec3(1.0, 1.0, 1.0);
    vec3 texel;
    Mat  mat;

    RayHitResult res;

    for (int i = 0; i <= u_num_bounces; ++i) {
        if (rayIntersectBVH(ray, res)) {
            mat.albedo = texelFetch(u_mat_sampler, ivec2(0, res.mi), 0).xyz;
            texel      = texelFetch(u_mat_sampler, ivec2(1, res.mi), 0).xyz;
            mat.shininess       = texel.x;
            mat.refractionIndex = texel.y;
            mat.materialClass   = int(texel.z);

            switch (mat.materialClass) {
            case METALLIC_MATERIAL:
                rayHitMetallicSurface(res, mat, ray, color);
                break;
            case LAMBERTIAN_MATERIAL:
                rayHitLambertianSurface(res, mat, ray, color);
                break;
            case DIELECTRIC_MATERIAL:
                rayHitDielectricSurface(res, mat, ray, color);
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

    // seed the random number generator before using rand(), use render pass number to change the seed for every pass
    g_randGeneratorState = texelFetch(u_noise_sampler, fragCoord, 0)
                            + uvec4(u_render_pass, u_render_pass, u_render_pass, u_render_pass);

    vec4 rayTarget = u_eye_to_world * vec4( // transform pos on image plane from view space to world space
        v_eye_to_x + rand(),
        u_eye_to_image,
        v_eye_to_z + rand(),
        1.0
    );

    Ray ray = Ray(u_eye_position, normalize(rayTarget.xyz - u_eye_position));
    if (u_render_pass > 1) {
        o_color = vec4(castPrimaryRay(ray), 0.0) + texelFetch(u_color_sampler, fragCoord, 0);
    } else {
        o_color = vec4(castPrimaryRay(ray), 1.0);
    }
}
