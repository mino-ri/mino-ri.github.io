import { ShaderSource } from "./gpu"

// シェーダー実装
const shaderCode = /* wgsl */`
struct Uniforms {
    modelMatrix: mat4x4<f32>,
    viewProjectionMatrix: mat4x4<f32>,
    lightProjection: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
}

struct InstanceVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

struct BallInput {
    @location(3) position: vec3<f32>,
}

struct LineInput {
    @location(3) positionA: vec3<f32>,
    @location(4) positionB: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec4<f32>,
    @location(1) color: vec3<f32>,
}

struct InstanceVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec4<f32>,
    @location(1) color: vec3<f32>,
    @location(2) worldNormal: vec3<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    output.worldPos = worldPos;
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.color = input.color;
    return output;
}

@vertex
fn vertexBallMain(input: InstanceVertexInput, ballInput: BallInput) -> InstanceVertexOutput {
    var output: InstanceVertexOutput;
    let worldPos = uniforms.modelMatrix * vec4<f32>(ballInput.position, 1.0) + vec4<f32>(input.position, 0.0);
    output.worldPos = worldPos;
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.worldNormal = input.normal;
    output.color = input.color;
    return output;
}

@vertex
fn vertexLineMain(input: InstanceVertexInput, lineInput: LineInput) -> InstanceVertexOutput {
    let lineDir = lineInput.positionB - lineInput.positionA;
    let zDir = normalize(lineDir);
    let xDir = normalize(cross(zDir, select(vec3<f32>(1, 0, 0), vec3<f32>(0, 1, 0), abs(zDir.x) > 0.9)));
    let yDir = normalize(cross(zDir, xDir));
    var output: InstanceVertexOutput;
    let pos3 = lineInput.positionA + input.position.x * xDir + input.position.y * yDir + input.position.z * lineDir;
    let worldPos = uniforms.modelMatrix * vec4<f32>(pos3, 1.0);
    output.worldPos = worldPos;
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.worldNormal = (uniforms.modelMatrix * vec4<f32>(input.normal.x * xDir + input.normal.y * yDir, 0.0)).xyz;
    output.color = input.color;
    return output;
}

@vertex
fn vertexShadow(input: VertexInput) -> @builtin(position) vec4<f32> {
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    return uniforms.lightProjection * worldPos;
}

@vertex
fn vertexBallShadow(input: VertexInput, ballInput: BallInput) -> @builtin(position) vec4<f32> {
    let worldPos = uniforms.modelMatrix * vec4<f32>(ballInput.position, 1.0) + vec4<f32>(input.position, 0.0);
    return uniforms.lightProjection * worldPos;
}

@vertex
fn vertexLineShadow(input: VertexInput, lineInput: LineInput) -> @builtin(position) vec4<f32> {
    let lineDir = lineInput.positionB - lineInput.positionA;
    let zDir = normalize(lineDir);
    let xDir = normalize(cross(zDir, select(vec3<f32>(1, 0, 0), vec3<f32>(0, 1, 0), abs(zDir.x) > 0.9)));
    let yDir = normalize(cross(zDir, xDir));
    let pos3 = lineInput.positionA + input.position.x * xDir + input.position.y * yDir + input.position.z * lineDir;
    let worldPos = uniforms.modelMatrix * vec4<f32>(pos3, 1.0);
    return uniforms.lightProjection * worldPos;
}

fn fragmentCore(worldPos: vec4<f32>, color: vec3<f32>, worldNormal: vec3<f32>) -> vec4<f32> {
    let normal = normalize(worldNormal);
    var shadowPos = uniforms.lightProjection * (worldPos + vec4<f32>(normal / 512.0, 0.0));
    shadowPos = shadowPos / shadowPos.w;
    shadowPos.x = 0.5 + shadowPos.x * 0.5;
    shadowPos.y = 0.5 - shadowPos.y * 0.5;
    let shadowFactor = textureSampleCompare(shadowMap, shadowSampler, shadowPos.xy, shadowPos.z);
    let shadow = 0.5 + shadowFactor * 0.5;
    let lightPos = vec3<f32>(-1.5085136, -5.1947107, -7.4417315);
    let sight = vec3<f32>(0.0, 0.0, -5.0);
    let lightDir = normalize(lightPos - worldPos.xyz);
    let cameraDir = normalize(sight - worldPos.xyz);
    let halfVector = normalize(lightDir + cameraDir);
    let diffuse = max(0, dot(normal.xyz, lightDir)) * 0.85;
    let specula = pow(max(0, dot(normal.xyz, halfVector)), 5.0) * 0.2;
    let ambient = 0.2;
    let brightness = (ambient + diffuse * shadow);
    return vec4<f32>(color * brightness + vec3<f32>(specula, specula, specula) * shadow, 1.0);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let dx = dpdx(input.worldPos.xyz);
    let dy = dpdy(input.worldPos.xyz);
    return fragmentCore(input.worldPos, input.color, -cross(dx, dy));
}

@fragment
fn fragmentInstanceMain(input: InstanceVertexOutput) -> @location(0) vec4<f32> {
    return fragmentCore(input.worldPos, input.color, input.worldNormal);
}

@fragment
fn fragmentEmpty() {
}  
`

const constantBufferValue = new Float32Array([
    // View-Projection 行列 (perspective + lookAt)
    4, 0, 0, 0,
    0, -4, 0, 0,
    0, 0, 1.75, 1,
    -0.009765625, 0.009765625, 3.5, 5,
    // lightProjection
    8.96319, 1.025915, 0.836241245, 0.163968876,
    0, -7.548099, 2.87967658, 0.5646425,
    -1.81692851, 5.06099749, 4.12530756, 0.808883846,
    -0.0178622864, 0.0178622864, 5.09999847, 9.2,
])


const vertexBufferLayout: GPUVertexBufferLayout = {
    stepMode: "vertex",
    arrayStride: 6 * 4,
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
        { shaderLocation: 1, offset: 12, format: "float32x3" }, // color
    ],
}

const ballInstanceBufferLayout: GPUVertexBufferLayout = {
    stepMode: "instance",
    arrayStride: 3 * 4,
    attributes: [
        { shaderLocation: 3, offset: 0, format: "float32x3" }, // position
    ],
}

const lineInstanceBufferLayout: GPUVertexBufferLayout = {
    stepMode: "instance",
    arrayStride: 6 * 4,
    attributes: [
        { shaderLocation: 3, offset: 0, format: "float32x3" }, // position
        { shaderLocation: 4, offset: 12, format: "float32x3" }, // position
    ],
}

export const shaderSource: ShaderSource = {
    shaderCode,
    dynamicBufferByteSize: 64,
    constantBufferValue,
    vertexBufferLayout,
    ballInstanceBufferLayout,
    lineInstanceBufferLayout,
}
