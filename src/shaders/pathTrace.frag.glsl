// Fragment shader for the path-tracing pass: traces one sample of light through every pixel.
//
// Each pixel fires a ray through its position on the image plane, with a random jitter inside the pixel. The ray
// starts at a random point on the camera's lens, so surfaces off the focus plane blur. The ray is followed through the
// scene by walking a bounding volume hierarchy (BVH) of triangles, and bounces off diffuse, reflective and glass
// surfaces until it reaches a light or runs out of bounces. The result is added to the accumulation texture, which
// averages many such samples.
//
// The scene arrives as packed textures. The `*_INDEX` and `*_MATERIAL` constants below must match
// `src/lib/webgl/sceneLayout.ts`, which sets the layout the CPU writes.

precision highp int;
precision highp float;

// --- structures ----------------------------------------------------------------------
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

struct Material {
    int   materialClass;
    vec3  albedo;
    float reflectionRatio;
    float reflectionGloss;
    float refractionIndex;
};

// --- constants -----------------------------------------------------------------------
const float MAX_FLT = intBitsToFloat(2139095039);
const float EPSILON = 0.001;
const float PI = 3.14159265359;

const int FLAT_SHADING = 0;

// The bounce index, counting from 0, from which Russian roulette may end dim paths early. 3 means the fourth bounce.
// See the comment in `pathTrace`.
const int ROULETTE_START_BOUNCE = 3;

const int EMISSIVE_MATERIAL   = 0;
const int REFLECTIVE_MATERIAL = 1;
const int DIELECTRIC_MATERIAL = 2;

const int BVH_MAX_STACK_SIZE = 24;
const int BVH_NODE_MIN_BOUNDS_INDEX = 0;
const int BVH_NODE_MAX_BOUNDS_INDEX = 1;
const int BVH_NODE_PAYLOAD_INDEX = 2;

const int FACE_NRM_INDEX = 0;
const int VERTEX_0_POS_INDEX = 1;
const int VERTEX_1_POS_INDEX = 2;
const int VERTEX_2_POS_INDEX = 3;
const int VERTEX_0_NRM_INDEX = 4;
const int VERTEX_1_NRM_INDEX = 5;
const int VERTEX_2_NRM_INDEX = 6;
const int FACE_MATERIAL_INDEX = 7;

// Faces and BVH nodes wrap onto rows of this many entries, so a mesh with many faces needs a short texture instead of a
// tall one. All four constants must equal their counterparts in `src/lib/webgl/sceneLayout.ts`: `facesPerRow`,
// `bvhNodesPerRow`, `numTexelsPerFace` and `numTexelsPerBvhNode`.
const int FACES_PER_ROW = 64;
const int BVH_NODES_PER_ROW = 64;
const int TEXELS_PER_FACE = 8;
const int TEXELS_PER_BVH_NODE = 3;

const int MATERIAL_ALBEDO_INDEX = 0;
const int MATERIAL_ATTRIB_INDEX = 1;

// Lights wrap onto rows of this many entries, like faces. Both constants must equal their counterparts in
// `src/lib/webgl/sceneLayout.ts`: `lightsPerRow` and `numTexelsPerLight`.
const int LIGHTS_PER_ROW = 64;
const int TEXELS_PER_LIGHT = 3;

// --- globals -------------------------------------------------------------------------
uvec4 g_randGeneratorState; // random number generator current state

// --- uniforms ------------------------------------------------------------------------
uniform highp usampler2D u_random_sampler;
uniform highp sampler2DArray u_face_sampler;
uniform highp sampler2DArray u_bvh_sampler;
uniform highp sampler2D u_material_sampler;
uniform highp sampler2D u_light_sampler; // one emissive face per entry, see `src/lib/webgl/sceneLayout.ts`

uniform int u_num_objects; // number of models/objects to render
uniform int u_num_lights; // number of emissive faces in the lights texture, 0 when the scene has no light
uniform int u_sample_number; // number of the sample being traced, starting at 1
uniform int u_num_bounces; // max number of ray bounces
uniform int u_shading_method; // flat or Phong shading

uniform float u_lens_radius; // radius of the camera lens in world units, 0 for a pinhole
uniform float u_focus_distance; // distance from the eye to the plane that stays sharp, along the camera's -z axis
uniform float u_eye_to_image; // distance from the eye to the image plane along the camera's -z axis, in pixels
uniform vec3  u_eye_position; // eye position in world space
uniform mat4  u_eye_to_world; // camera to world space matrix (BVH, rays and triangles are all stored in world space)

// --- varyings ------------------------------------------------------------------------
in float v_eye_to_x;
in float v_eye_to_y;

// --- outputs -------------------------------------------------------------------------
layout (location = 0) out vec4 o_color;

// --- randomness ----------------------------------------------------------------------
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

// --- texel addresses -----------------------------------------------------------------
// Texel `texel` of light `light` in the lights texture.
ivec2 lightTexel(int texel, int light) {
    return ivec2((light % LIGHTS_PER_ROW) * TEXELS_PER_LIGHT + texel, light / LIGHTS_PER_ROW);
}

// Texel `texel` of face `face` in object `obj`'s slice of the faces texture.
ivec3 faceTexel(int texel, int face, int obj) {
    return ivec3((face % FACES_PER_ROW) * TEXELS_PER_FACE + texel, face / FACES_PER_ROW, obj);
}

// Texel `texel` of BVH node `node` in object `obj`'s slice of the BVH texture.
ivec3 bvhTexel(int texel, int node, int obj) {
    return ivec3((node % BVH_NODES_PER_ROW) * TEXELS_PER_BVH_NODE + texel, node / BVH_NODES_PER_ROW, obj);
}

// --- ray intersect objects -----------------------------------------------------------
// Ray-triangle test (the Möller–Trumbore method), which solves for the hit distance `t` and the hit point's
// barycentric weights in one step. Barycentric weights say how much of each vertex makes up a point on the triangle.
// They are all between 0 and 1 and add up to 1 exactly when the point lies inside it. The test reads only the three
// vertex positions, so a face the ray misses costs three texture reads. The caller computes the hit point and fetches
// the normal and material for the nearest hit only.
bool rayIntersectFace(Ray r, int face_index, int obj_index, out RayHitResult res) {
    vec3 p0 = texelFetch(u_face_sampler, faceTexel(VERTEX_0_POS_INDEX, face_index, obj_index), 0).xyz;
    vec3 p1 = texelFetch(u_face_sampler, faceTexel(VERTEX_1_POS_INDEX, face_index, obj_index), 0).xyz;
    vec3 p2 = texelFetch(u_face_sampler, faceTexel(VERTEX_2_POS_INDEX, face_index, obj_index), 0).xyz;

    vec3 e1 = p1 - p0;
    vec3 e2 = p2 - p0;
    vec3 pvec = cross(r.dir, e2);
    float det = dot(e1, pvec);
    // `det` is the cosine between the ray and the face normal, times twice the face's area. A ray within about 0.06° of
    // the face's plane is rejected, so a grazing ray never hits the face at an unstable distance.
    if (abs(det) < EPSILON * length(cross(e1, e2))) {
        return false;
    }

    float invDet = 1.0 / det;
    vec3 tvec = r.origin - p0;
    float v = dot(tvec, pvec) * invDet; // weight of vertex 1
    if (v < 0.0 || v > 1.0) {
        return false;
    }

    vec3 qvec = cross(tvec, e1);
    float w = dot(r.dir, qvec) * invDet; // weight of vertex 2
    if (w < 0.0 || v + w > 1.0) {
        return false;
    }

    float t = dot(e2, qvec) * invDet;
    if (t < EPSILON) { // contact point behind the ray, or at its own origin
        return false;
    }

    res.t = t;
    res.u = 1.0 - v - w; // weight of vertex 0
    res.v = v;
    res.w = w;
    res.fi = face_index;
    res.oi = obj_index;
    return true;
}

// Ray-box test (the slab method). A box is the overlap of three slabs, one pair of parallel planes per axis, so the
// ray is inside the box between its latest slab entry and its earliest slab exit. The ray's direction comes already
// inverted, so the test multiplies instead of divides. `tEnter` is where the ray enters the box, or 0 when it starts
// inside. A box entirely behind the ray misses.
bool rayIntersectBvhNode(Ray r, vec3 invDir, vec3 nodeMin, vec3 nodeMax, out float tEnter) {
    vec3 t0 = (nodeMin - r.origin) * invDir;
    vec3 t1 = (nodeMax - r.origin) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);

    tEnter = max(max(tmin.x, max(tmin.y, tmin.z)), 0.0);
    float tExit = min(tmax.x, min(tmax.y, tmax.z));
    return tEnter <= tExit;
}

// Tests a ray against BVH node `node` of object `obj`.
bool rayIntersectNode(Ray r, vec3 invDir, int node, int obj, out float tEnter) {
    return rayIntersectBvhNode(r, invDir,
        texelFetch(u_bvh_sampler, bvhTexel(BVH_NODE_MIN_BOUNDS_INDEX, node, obj), 0).xyz,
        texelFetch(u_bvh_sampler, bvhTexel(BVH_NODE_MAX_BOUNDS_INDEX, node, obj), 0).xyz,
        tEnter);
}

// Walks each object's BVH tree for face hits closer than `tMax`, and returns whether it found one. With `anyHit` it
// returns on the first hit, which is all a shadow ray needs. Otherwise it keeps the nearest hit in `nearest`.
//
// A node's children are tested before they are pushed, and the nearer one is pushed last, so it is visited first.
// Finding a close hit early lets the walk skip every node whose box starts farther away. The entry distance kept
// beside each stacked node is checked again when the node is popped.
bool traceBVH(Ray r, float tMax, bool anyHit, out RayHitResult nearest) {
    int stackNode[BVH_MAX_STACK_SIZE];
    float stackT[BVH_MAX_STACK_SIZE];
    RayHitResult current;
    vec3 invDir = 1.0 / r.dir;

    nearest.t = tMax;

    for (int obj = 0; obj < u_num_objects; ++obj) { // each mesh has its own tree, with its root at node 0
        float tRoot;
        if (!rayIntersectNode(r, invDir, 0, obj, tRoot) || tRoot >= nearest.t) {
            continue;
        }

        // The stack holds each node still to visit and the distance where the ray enters its box. The pushes are written
        // out instead of calling a function, because passing the arrays to a function copies them on every call.
        int top = 0;
        stackNode[0] = 0;
        stackT[0] = tRoot;

        while (top > -1) {
            int node = stackNode[top];
            float tNode = stackT[top];
            --top;
            if (tNode >= nearest.t) { // a closer hit was found after this node was pushed
                continue;
            }

            vec4 payload = texelFetch(u_bvh_sampler, bvhTexel(BVH_NODE_PAYLOAD_INDEX, node, obj), 0);
            int lt = int(payload.r); // left child node, or -1
            int rt = int(payload.g); // right child node, or -1
            int firstFace = int(payload.b); // a leaf's first face. A leaf's faces are stored next to each other.
            int faceCount = int(payload.a); // a leaf's number of faces, 0 for an interior node

            for (int f = firstFace; f < firstFace + faceCount; ++f) {
                if (rayIntersectFace(r, f, obj, current) && current.t < nearest.t) {
                    nearest = current;
                    if (anyHit) {
                        return true;
                    }
                }
            }

            float tL;
            float tR;
            bool hitL = lt != -1 && rayIntersectNode(r, invDir, lt, obj, tL) && tL < nearest.t;
            bool hitR = rt != -1 && rayIntersectNode(r, invDir, rt, obj, tR) && tR < nearest.t;

            // Push the farther child first, so the nearer one is popped next. After the swap, `lt` is the nearer child.
            if (hitL && hitR && tR < tL) {
                int swapNode = lt;
                lt = rt;
                rt = swapNode;
                float swapT = tL;
                tL = tR;
                tR = swapT;
            }
            if (hitR) {
                ++top;
                stackNode[top] = rt;
                stackT[top] = tR;
            }
            if (hitL) {
                ++top;
                stackNode[top] = lt;
                stackT[top] = tL;
            }
        }
    }

    return nearest.t < tMax;
}

// Whether anything blocks a ray before distance `maxT`.
bool rayOccluded(Ray r, float maxT) {
    RayHitResult blocker;
    return traceBVH(r, maxT, true, blocker);
}

// Finds the nearest hit along a ray, and fetches its position, normals and material.
bool rayIntersectBVH(Ray r, out RayHitResult nearest) {
    if (!traceBVH(r, MAX_FLT, false, nearest)) {
        return false;
    }

    // Shading data for the nearest hit only.
    int obj_index = nearest.oi;
    int face_index = nearest.fi;
    nearest.p = r.origin + nearest.t * r.dir;
    nearest.fn = texelFetch(u_face_sampler, faceTexel(FACE_NRM_INDEX, face_index, obj_index), 0).xyz;
    if (u_shading_method == FLAT_SHADING) { // use the face normal for flat shading
        nearest.n = nearest.fn;
    } else { // interpolate vertex normals using barycentric coordinates to implement Phong shading
        nearest.n = normalize(
            (texelFetch(u_face_sampler, faceTexel(VERTEX_0_NRM_INDEX, face_index, obj_index), 0).xyz * nearest.u) +
            (texelFetch(u_face_sampler, faceTexel(VERTEX_1_NRM_INDEX, face_index, obj_index), 0).xyz * nearest.v) +
            (texelFetch(u_face_sampler, faceTexel(VERTEX_2_NRM_INDEX, face_index, obj_index), 0).xyz * nearest.w)
        );
    }
    nearest.mi = int(texelFetch(u_face_sampler, faceTexel(FACE_MATERIAL_INDEX, face_index, obj_index), 0).x); // material index
    return true;
}

// --- ray cast from eye through image pixel -------------------------------------------
float schlick(float cosine, float rindex) {
    float  r0 = (1.0 - rindex) / (1.0 + rindex); r0 *= r0;
    return r0 + (1.0 - r0) * pow((1.0 - cosine), 5.0);
}

void rayBounceOffMirror(inout Ray ray, RayHitResult res, Material material) {
    ray.origin = res.p + res.fn * EPSILON;
    ray.dir = normalize(reflect(ray.dir, res.n) + (1.0 - material.reflectionGloss) * randPosInUnitSphere());
}

void rayBounceOffDiffuse(inout Ray ray, RayHitResult res) {
    ray.origin = res.p + res.fn * EPSILON;
    ray.dir = normalize(res.p + res.n + randPosInUnitSphere() - res.p);
}

void rayBounceOffDielectricSurface(inout Ray ray, RayHitResult res, Material material) {
    float refractionRatio;
    float reflectionProb;
    float cosine;
    vec3  refraction;
    vec3  n;

    if (dot(ray.dir, res.n) < 0.0) { // into liquid/solid from air
        refractionRatio = 1.0 / material.refractionIndex;
        n  = +res.n;
        cosine = -dot(ray.dir, res.n);
    } else { // from object into air
        refractionRatio = material.refractionIndex;
        n  = -res.n;
        cosine =  dot(ray.dir, res.n) * material.refractionIndex;
    }

    refraction = refract(ray.dir, n, refractionRatio);
    if (dot(refraction, refraction) > 0.0) {
        reflectionProb = schlick(cosine, material.refractionIndex);
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

// --- light sampling and path tracing -------------------------------------------------
// Picks a point on a light, with a chance in proportion to each light's area, and returns the light that point sends to
// the hit through the diffuse lobe. The result is zero when the point is behind the surface or something blocks it.
//
// `rayBounceOffDiffuse` sends the ray along n + a random point in the unit ball. That direction has the density
// 2 * cos(theta)^3 / PI per unit of solid angle, with theta measured from the normal. A light sample must use the same
// density, or the lit areas would come out a different brightness than the bounce rays give.
vec3 sampleDirectLight(RayHitResult hit, vec3 albedo) {
    if (u_num_lights == 0) {
        return vec3(0.0);
    }

    // The first texel's w holds the running total of the light areas, so a binary search finds the light that the
    // random target falls in.
    float totalArea = texelFetch(u_light_sampler, lightTexel(0, u_num_lights - 1), 0).w;
    float target = rand() * totalArea;
    int low = 0;
    int high = u_num_lights - 1;
    while (low < high) {
        int mid = (low + high) / 2;
        if (texelFetch(u_light_sampler, lightTexel(0, mid), 0).w < target) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    vec3 p0 = texelFetch(u_light_sampler, lightTexel(0, low), 0).xyz;
    vec3 p1 = texelFetch(u_light_sampler, lightTexel(1, low), 0).xyz;
    vec4 texel2 = texelFetch(u_light_sampler, lightTexel(2, low), 0);
    vec3 p2 = texel2.xyz;
    vec3 emission = texelFetch(u_material_sampler, ivec2(MATERIAL_ALBEDO_INDEX, int(texel2.w)), 0).xyz;

    // A uniformly distributed point on the light's face.
    float r1 = sqrt(rand());
    float r2 = rand();
    vec3 lightPoint = p0 * (1.0 - r1) + p1 * (r1 * (1.0 - r2)) + p2 * (r1 * r2);
    vec3 lightNormal = normalize(cross(p1 - p0, p2 - p0));

    vec3 origin = hit.p + hit.fn * EPSILON; // the same origin the diffuse bounce uses
    vec3 toLight = lightPoint - origin;
    float dist = length(toLight);
    vec3 dir = toLight / dist;

    float cosSurface = dot(hit.n, dir);
    float cosLight = abs(dot(lightNormal, dir)); // a light emits from both sides, like a ray that hits it
    if (cosSurface <= 0.0 || cosLight <= 0.0) {
        return vec3(0.0);
    }

    if (rayOccluded(Ray(origin, dir), dist - 2.0 * EPSILON)) {
        return vec3(0.0);
    }

    // The bounce direction's density, times the albedo and the light's emission, times the area-to-solid-angle
    // conversion, divided by the chance of picking this point (one over the total light area).
    float density = 2.0 * cosSurface * cosSurface * cosSurface / PI;
    return albedo * emission * (density * cosLight * totalArea / (dist * dist));
}

vec3 pathTrace(Ray ray) {
    vec3 radiance = vec3(0.0);
    vec3 throughput = vec3(1.0);
    bool countEmission = true; // false right after a diffuse bounce, because sampleDirectLight already counted the light
    RayHitResult hit;
    Material material;
    vec4 texel;

    for (int i = 0; i <= u_num_bounces; ++i) {
        if (!rayIntersectBVH(ray, hit)) {
            break;
        }

        material.albedo = texelFetch(u_material_sampler, ivec2(MATERIAL_ALBEDO_INDEX, hit.mi), 0).xyz;
        texel = texelFetch(u_material_sampler, ivec2(MATERIAL_ATTRIB_INDEX, hit.mi), 0);
        material.materialClass = int(texel.x);
        material.reflectionRatio = texel.y;
        material.reflectionGloss = texel.z;
        material.refractionIndex = texel.w;

        if (material.materialClass == EMISSIVE_MATERIAL) {
            if (countEmission) {
                radiance += throughput * material.albedo;
            }
            break;
        }

        if (i == u_num_bounces) { // out of bounces, so the surface glows with its own color as ambient light
            radiance += throughput * material.albedo;
            break;
        }

        if (material.materialClass == REFLECTIVE_MATERIAL) {
            if (rand() < material.reflectionRatio) {
                rayBounceOffMirror(ray, hit, material);
                if (dot(ray.dir, hit.n) < 0.0) { // absorb ray
                    break;
                }
                countEmission = true;
            } else {
                radiance += throughput * sampleDirectLight(hit, material.albedo);
                rayBounceOffDiffuse(ray, hit);
                countEmission = false;
            }
        } else { // dielectric
            rayBounceOffDielectricSurface(ray, hit, material);
            countEmission = true;
        }

        throughput *= material.albedo;

        // Russian roulette: a path continues with a chance equal to its brightest throughput channel, so a path that can
        // only add a little light usually stops here. A surviving path is divided by that chance, which keeps the
        // average brightness the same. The first bounces always continue, because they carry most of the light.
        if (i >= ROULETTE_START_BOUNCE) {
            float survival = clamp(max(throughput.r, max(throughput.g, throughput.b)), 0.05, 1.0);
            if (rand() > survival) { // `>` because rand() can return exactly 1.0
                break;
            }
            throughput /= survival;
        }
    }

    return radiance;
}

// --- main ----------------------------------------------------------------------------
void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);

    // seed the random number generator before using rand(), use the sample number to change the seed for every sample
    g_randGeneratorState = texelFetch(u_random_sampler, fragCoord, 0)
                            + uvec4(u_sample_number, u_sample_number, u_sample_number, u_sample_number);

    // The direction through this pixel in camera space (x right, y up, looking down -z), jittered inside the pixel.
    vec3 dirCamera = normalize(vec3(v_eye_to_x + rand(), v_eye_to_y + rand(), -u_eye_to_image));
    vec3 dirWorld = normalize((u_eye_to_world * vec4(dirCamera, 0.0)).xyz);

    // Thin lens: every ray through this pixel meets at the point where the pinhole ray crosses the focus plane. The ray
    // starts at a random point on the lens instead of the eye, so points off that plane blur.
    vec3 focusPoint = u_eye_position + dirWorld * (u_focus_distance / -dirCamera.z);
    float lensRadius = u_lens_radius * sqrt(rand());
    float lensAngle = 6.2831853 * rand();
    vec3 lensOffset = (u_eye_to_world * vec4(lensRadius * cos(lensAngle), lensRadius * sin(lensAngle), 0.0, 0.0)).xyz;
    vec3 origin = u_eye_position + lensOffset;

    Ray ray = Ray(origin, normalize(focusPoint - origin));
    // The render target adds this output to what it already holds (additive blending). Alpha adds up to the number
    // of samples the pixel has received, which the display shader divides by.
    o_color = vec4(pathTrace(ray), 1.0);
}
