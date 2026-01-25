import { Vectors } from "./vector.js";
const shaderCode = `
struct Uniforms {
    modelMatrix: mat4x4<f32>,
    viewProjectionMatrix: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldNormal: vec3<f32>,
    @location(1) color: vec3<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.worldNormal = (uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
    output.color = input.color;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.7));
    let normal = normalize(input.worldNormal);
    let ambient = 0.3;
    let diffuse = max(dot(normal, lightDir), 0.0) * 0.7;
    let brightness = ambient + diffuse;
    return vec4<f32>(input.color * brightness, 1.0);
}
`;
const faceColors = [
    [1.0, 0.9, 0.3],
    [1.0, 0.3, 0.3],
    [0.3, 0.8, 0.3],
    [0.3, 0.5, 1.0],
];
export const initGpu = async (canvas) => {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported");
        return null;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        console.error("Failed to get GPU adapter");
        return null;
    }
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
        console.error("Failed to get WebGPU context");
        return null;
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format,
        alphaMode: "premultiplied",
    });
    return new GpuContextImpl(device, context, format);
};
class GpuContextImpl {
    device;
    context;
    format;
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
    }
    createPolyhedronRenderer() {
        return new PolyhedronRendererImpl(this.device, this.context, this.format);
    }
}
function createViewProjectionMatrix(aspectRatio) {
    const fov = Math.PI / 6;
    const near = 1;
    const far = 9;
    const f = 1 / Math.tan(fov / 2);
    const proj = new Float32Array([
        f / aspectRatio, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) / (near - far), -1,
        0, 0, (2 * far * near) / (near - far), 0,
    ]);
    const eyeZ = 5;
    const view = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -eyeZ, 1,
    ]);
    return multiplyMat4(proj, view);
}
function multiplyMat4(a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                sum += a[i + k * 4] * b[k + j * 4];
            }
            result[i + j * 4] = sum;
        }
    }
    return result;
}
class PolyhedronRendererImpl {
    device;
    context;
    format;
    pipeline;
    uniformBuffer;
    bindGroup;
    vertexBuffer = null;
    vertexCount = 0;
    depthTexture = null;
    lastWidth = 0;
    lastHeight = 0;
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
        const shaderModule = device.createShaderModule({ code: shaderCode });
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" },
                }],
        });
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });
        this.pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [{
                        arrayStride: 9 * 4,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: "float32x3" },
                            { shaderLocation: 1, offset: 12, format: "float32x3" },
                            { shaderLocation: 2, offset: 24, format: "float32x3" },
                        ],
                    }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.format }],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "back",
                frontFace: "ccw",
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
        });
        this.uniformBuffer = device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                }],
        });
    }
    updateMesh(mesh) {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
        }
        this.vertexBuffer = this.device.createBuffer({
            size: mesh.vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, mesh.vertexData.buffer, mesh.vertexData.byteOffset, mesh.vertexData.byteLength);
        this.vertexCount = mesh.vertexCount;
    }
    render(modelMatrix) {
        if (!this.vertexBuffer || this.vertexCount === 0) {
            return;
        }
        const canvas = this.context.canvas;
        const width = canvas.width;
        const height = canvas.height;
        if (width !== this.lastWidth || height !== this.lastHeight) {
            if (this.depthTexture) {
                this.depthTexture.destroy();
            }
            this.depthTexture = this.device.createTexture({
                size: [width, height],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            this.lastWidth = width;
            this.lastHeight = height;
        }
        const viewProjection = createViewProjectionMatrix(width / height);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, viewProjection.buffer, viewProjection.byteOffset, viewProjection.byteLength);
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.vertexCount);
        passEncoder.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }
    destroy() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
        }
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }
        this.uniformBuffer.destroy();
    }
}
const crosses = [
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
    { value: null, source: [0, 0, 0] },
];
export function buildPolyhedronMesh(vertexes, faces) {
    const triangles = [];
    const cv = [0, 0, 0];
    const nv = [0, 0, 0];
    const mv = [0, 0, 0];
    for (const face of faces) {
        const indexes = face.VertexIndexes;
        const colorIndex = Math.min(face.ColorIndex, faceColors.length - 1);
        const [r, g, b] = faceColors[colorIndex];
        cv[0] = 0;
        cv[1] = 0;
        cv[2] = 0;
        for (const idx of indexes) {
            const v = vertexes[idx];
            Vectors.add(cv, v, cv);
        }
        Vectors.div(cv, indexes.length, cv);
        for (let i = 0; i < indexes.length; i++) {
            const v0 = vertexes[indexes[i]];
            const v1 = vertexes[indexes[(i + 1) % indexes.length]];
            const crossPoint = Vectors.getCrossPoint(vertexes[indexes[(i + indexes.length - 1) % indexes.length]], v0, v1, vertexes[indexes[(i + 2) % indexes.length]], crosses[i].source);
            crosses[i].value = null;
            if (crossPoint !== null) {
                const maxDistance = Vectors.middleDistanceSquared(v0, v1, cv);
                const distance1 = Vectors.middleDistanceSquared(v0, v1, crossPoint);
                const distance2 = Vectors.distanceSquared(crossPoint, cv);
                if (distance1 < maxDistance && distance2 < maxDistance) {
                    crosses[i].value = crossPoint;
                }
            }
        }
        for (let i = 0; i < indexes.length; i++) {
            const beforeIndex = (i + indexes.length - 1) % indexes.length;
            const afterIndex = (i + 1) % indexes.length;
            const v0 = crosses[i].value ?? cv;
            const v1 = crosses[beforeIndex].value ?? vertexes[indexes[i]];
            const v2 = crosses[afterIndex].value ?? vertexes[indexes[afterIndex]];
            Vectors.sub(v1, v0, nv);
            Vectors.sub(v2, v0, mv);
            Vectors.cross(nv, mv, nv);
            Vectors.normalizeSelf(nv);
            const nx = nv[0];
            const ny = nv[1];
            const nz = nv[2];
            triangles.push(v0[0], v0[1], v0[2], nx, ny, nz, r, g, b, v1[0], v1[1], v1[2], nx, ny, nz, r, g, b, v2[0], v2[1], v2[2], nx, ny, nz, r, g, b);
        }
    }
    return {
        vertexData: new Float32Array(triangles),
        vertexCount: triangles.length / 9,
    };
}
export function quaternionToMatrix(w, x, y, z) {
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;
    return new Float32Array([
        1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
        2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
        2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
        0, 0, 0, 1,
    ]);
}
