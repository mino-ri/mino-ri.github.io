import { Vectors } from "./vector.js";
const shaderCode = `
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
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec4<f32>,
    @location(1) worldNormal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    output.worldPos = worldPos;
    output.position = uniforms.viewProjectionMatrix * worldPos;
    output.worldNormal = (uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
    output.color = input.color;
    return output;
}

@vertex
fn vertexShadow(input: VertexInput) -> @builtin(position) vec4<f32> {
    let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
    let shadowPos = uniforms.lightProjection * worldPos;
    return shadowPos;
}

@fragment
fn fragmentMain(input: VertexOutput, @builtin(front_facing) isFront : bool) -> @location(0) vec4<f32> {
    let normal = normalize(input.worldNormal) * select(-1.0, 1.0, isFront);
    var shadowPos = uniforms.lightProjection * (input.worldPos + vec4<f32>(normal / 512.0, 0.0));
    shadowPos = shadowPos / shadowPos.w;
    shadowPos.x = 0.5 + shadowPos.x * 0.5;
    shadowPos.y = 0.5 - shadowPos.y * 0.5;
    let shadowFactor = textureSampleCompare(shadowMap, shadowSampler, shadowPos.xy, shadowPos.z);
    let shadow = 0.5 + shadowFactor * 0.5;
    let lightPos = vec3<f32>(-1.5085136, -5.1947107, -7.4417315);
    let sight = vec3<f32>(0.0, 0.0, -5.0);
    let lightDir = normalize(lightPos - input.worldPos.xyz);
    let cameraDir = normalize(sight - input.worldPos.xyz);
    let halfVector = normalize(lightDir + cameraDir);
    let diffuse = max(0, dot(normal.xyz, lightDir)) * 0.85;
    let specula = pow(max(0, dot(normal.xyz, halfVector)), 5.0) * 0.2;
    let ambient = 0.2;
    let brightness = (ambient + diffuse * shadow);
    return vec4<f32>(input.color * brightness + vec3<f32>(specula, specula, specula) * shadow, 1.0);
}
  
@fragment
fn fragmentEmpty() {
}  
`;
const faceColors = [
    [1.00, 0.85, 0.00],
    [1.00, 0.30, 0.04],
    [0.01, 0.68, 0.35],
    [0.00, 0.44, 1.00],
    [0.25, 0.88, 1.00],
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
const viewProjectionMatrix = new Float32Array([
    4, 0, 0, 0,
    0, -4, 0, 0,
    0, 0, 1.75, 1,
    -0.009765625, 0.009765625, 3.5, 5,
]);
const lightViewProjectionMatrix = new Float32Array([
    8.96319, 1.025915, 0.836241245, 0.163968876,
    0, -7.548099, 2.87967658, 0.5646425,
    -1.81692851, 5.06099749, 4.12530756, 0.808883846,
    -0.0178622864, 0.0178622864, 5.09999847, 9.2,
]);
class PolyhedronRendererImpl {
    device;
    context;
    format;
    pipeline;
    stencilPipeline;
    shadowPipeline;
    shadowStencilPipeline;
    uniformBuffer;
    shadowBindGroup;
    bindGroupLayout;
    bindGroup;
    vertexBuffer = null;
    polygons = [];
    totalVertexCount = 0;
    depthTexture = null;
    shadowTexture;
    shadowSampler;
    lastWidth = 0;
    lastHeight = 0;
    byteLength = 0;
    constructor(device, context, format) {
        this.device = device;
        this.context = context;
        this.format = format;
        const shaderModule = device.createShaderModule({ code: shaderCode });
        const vertexBuferLayout = {
            arrayStride: 9 * 4,
            attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x3" },
                { shaderLocation: 1, offset: 12, format: "float32x3" },
                { shaderLocation: 2, offset: 24, format: "float32x3" },
            ],
        };
        this.shadowSampler = device.createSampler({
            compare: 'less',
            magFilter: 'linear',
            minFilter: 'linear',
        });
        this.uniformBuffer = device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const shadowBindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            ],
        });
        this.shadowBindGroup = this.device.createBindGroup({
            layout: shadowBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
            ],
        });
        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
            ],
        });
        this.shadowTexture = this.device.createTexture({
            size: [2048, 2048],
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.shadowTexture.createView({ aspect: "depth-only" }) },
                { binding: 2, resource: this.shadowSampler },
            ],
        });
        const premitiveState = {
            topology: "triangle-list",
            cullMode: "none",
            frontFace: "ccw",
        };
        const shadowLayout = device.createPipelineLayout({
            bindGroupLayouts: [shadowBindGroupLayout],
        });
        const shadowVertexState = {
            module: shaderModule,
            entryPoint: "vertexShadow",
            buffers: [vertexBuferLayout],
        };
        const readDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilFront: {
                compare: "not-equal",
                passOp: "keep",
            },
            stencilBack: {
                compare: "not-equal",
                passOp: "keep",
            },
        };
        const writeDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: false,
            depthCompare: "always",
            stencilFront: {
                compare: "always",
                passOp: "invert",
            },
            stencilBack: {
                compare: "always",
                passOp: "invert",
            },
        };
        this.shadowPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        });
        this.shadowStencilPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        });
        const layout = device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayout],
        });
        const vertexState = {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBuferLayout],
        };
        this.pipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.format }],
            },
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        });
        this.stencilPipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentEmpty",
                targets: [{ format: this.format, writeMask: 0 }],
            },
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        });
    }
    updateMesh(mesh) {
        if (!this.vertexBuffer || this.byteLength < mesh.vertexData.byteLength) {
            this.vertexBuffer?.destroy();
            this.vertexBuffer = this.device.createBuffer({
                size: mesh.vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            this.byteLength = mesh.vertexData.byteLength;
        }
        this.device.queue.writeBuffer(this.vertexBuffer, 0, mesh.vertexData.buffer, mesh.vertexData.byteOffset, mesh.vertexData.byteLength);
        this.polygons = mesh.polygons;
        this.totalVertexCount = 0;
        for (const polygon of mesh.polygons) {
            this.totalVertexCount += polygon.vertexCount;
        }
    }
    render(modelMatrix) {
        if (!this.vertexBuffer) {
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
                format: "depth24plus-stencil8",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            this.lastWidth = width;
            this.lastHeight = height;
        }
        this.device.queue.writeBuffer(this.uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, viewProjectionMatrix.buffer, viewProjectionMatrix.byteOffset, viewProjectionMatrix.byteLength);
        this.device.queue.writeBuffer(this.uniformBuffer, 128, lightViewProjectionMatrix.buffer, lightViewProjectionMatrix.byteOffset, lightViewProjectionMatrix.byteLength);
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();
        let vertexIndex = 0;
        for (let i = 0; i < this.polygons.length; i++) {
            const polygon = this.polygons[i];
            const shadowPass = commandEncoder.beginRenderPass({
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: i === 0 ? "clear" : "load",
                    depthStoreOp: "store",
                    stencilClearValue: polygon.stencilEnabled ? 0 : 1,
                    stencilLoadOp: "clear",
                    stencilStoreOp: polygon.stencilEnabled ? "store" : "discard",
                },
            });
            if (polygon.stencilEnabled) {
                shadowPass.setPipeline(this.shadowStencilPipeline);
                shadowPass.setBindGroup(0, this.shadowBindGroup);
                shadowPass.setVertexBuffer(0, this.vertexBuffer);
                shadowPass.draw(polygon.vertexCount, 1, vertexIndex);
            }
            shadowPass.setPipeline(this.shadowPipeline);
            shadowPass.setBindGroup(0, this.shadowBindGroup);
            shadowPass.setVertexBuffer(0, this.vertexBuffer);
            shadowPass.draw(polygon.vertexCount, 1, vertexIndex);
            shadowPass.end();
            vertexIndex += polygon.vertexCount;
        }
        vertexIndex = 0;
        for (let i = 0; i < this.polygons.length; i++) {
            const polygon = this.polygons[i];
            const mainPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                        view: textureView,
                        clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                        loadOp: i === 0 ? "clear" : "load",
                        storeOp: "store",
                    }],
                depthStencilAttachment: {
                    view: this.depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: i === 0 ? "clear" : "load",
                    depthStoreOp: "store",
                    stencilClearValue: polygon.stencilEnabled ? 0 : 1,
                    stencilLoadOp: "clear",
                    stencilStoreOp: polygon.stencilEnabled ? "store" : "discard",
                },
            });
            if (polygon.stencilEnabled) {
                mainPass.setPipeline(this.stencilPipeline);
                mainPass.setBindGroup(0, this.bindGroup);
                mainPass.setVertexBuffer(0, this.vertexBuffer);
                mainPass.draw(polygon.vertexCount, 1, vertexIndex);
            }
            mainPass.setPipeline(this.pipeline);
            mainPass.setBindGroup(0, this.bindGroup);
            mainPass.setVertexBuffer(0, this.vertexBuffer);
            mainPass.draw(polygon.vertexCount, 1, vertexIndex);
            mainPass.end();
            vertexIndex += polygon.vertexCount;
        }
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
const ball = function () {
    const phi = (Math.sqrt(5) + 1) / 2;
    const phii = (Math.sqrt(5) - 1) / 2;
    const p1 = [-phii, 0, phi];
    const p2 = [-1, 1, 1];
    const p3 = [0, phi, phii];
    const p4 = [1, 1, 1];
    const p5 = [phii, 0, phi];
    const pc = Vectors.average([p1, p2, p3, p4, p5], [0, 0, 0]);
    Vectors.normalizeSelf(p1);
    Vectors.normalizeSelf(p2);
    Vectors.normalizeSelf(p3);
    Vectors.normalizeSelf(p4);
    Vectors.normalizeSelf(p5);
    Vectors.normalizeSelf(pc);
    return {
        p1: { point: Vectors.div(p1, 32), normal: p1 },
        p2: { point: Vectors.div(p2, 32), normal: p2 },
        p3: { point: Vectors.div(p3, 32), normal: p3 },
        p4: { point: Vectors.div(p4, 32), normal: p4 },
        p5: { point: Vectors.div(p5, 32), normal: p5 },
        pc: { point: Vectors.div(pc, 32), normal: pc },
    };
}();
const signs = [1, -1];
function addVertex(triangles, vertex) {
    const r = 0.95;
    const g = 0.95;
    const b = 0.95;
    for (let i = 0; i < 3; i++) {
        const xIndex = i;
        const yIndex = (i + 1) % 3;
        const zIndex = (i + 2) % 3;
        for (const ys of signs) {
            for (const zs of signs) {
                const signs = [1, ys, zs];
                let xSign = signs[xIndex];
                let ySign = signs[yIndex];
                let zSign = signs[zIndex];
                const p1x = vertex[0] + ball.p1.point[xIndex] * xSign;
                const p1y = vertex[1] + ball.p1.point[yIndex] * ySign;
                const p1z = vertex[2] + ball.p1.point[zIndex] * zSign;
                const p2x = vertex[0] + ball.p2.point[xIndex] * xSign;
                const p2y = vertex[1] + ball.p2.point[yIndex] * ySign;
                const p2z = vertex[2] + ball.p2.point[zIndex] * zSign;
                const p3x = vertex[0] + ball.p3.point[xIndex] * xSign;
                const p3y = vertex[1] + ball.p3.point[yIndex] * ySign;
                const p3z = vertex[2] + ball.p3.point[zIndex] * zSign;
                const p4x = vertex[0] + ball.p4.point[xIndex] * xSign;
                const p4y = vertex[1] + ball.p4.point[yIndex] * ySign;
                const p4z = vertex[2] + ball.p4.point[zIndex] * zSign;
                const p5x = vertex[0] + ball.p5.point[xIndex] * xSign;
                const p5y = vertex[1] + ball.p5.point[yIndex] * ySign;
                const p5z = vertex[2] + ball.p5.point[zIndex] * zSign;
                const pcx = vertex[0] + ball.pc.point[xIndex] * xSign;
                const pcy = vertex[1] + ball.pc.point[yIndex] * ySign;
                const pcz = vertex[2] + ball.pc.point[zIndex] * zSign;
                if (ys * zs === -1) {
                    triangles.push(p1x, p1y, p1z, ball.p1.normal[xIndex] * xSign, ball.p1.normal[yIndex] * ySign, ball.p1.normal[zIndex] * zSign, r, g, b, p2x, p2y, p2z, ball.p2.normal[xIndex] * xSign, ball.p2.normal[yIndex] * ySign, ball.p2.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p2x, p2y, p2z, ball.p2.normal[xIndex] * xSign, ball.p2.normal[yIndex] * ySign, ball.p2.normal[zIndex] * zSign, r, g, b, p3x, p3y, p3z, ball.p3.normal[xIndex] * xSign, ball.p3.normal[yIndex] * ySign, ball.p3.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p3x, p3y, p3z, ball.p3.normal[xIndex] * xSign, ball.p3.normal[yIndex] * ySign, ball.p3.normal[zIndex] * zSign, r, g, b, p4x, p4y, p4z, ball.p4.normal[xIndex] * xSign, ball.p4.normal[yIndex] * ySign, ball.p4.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p4x, p4y, p4z, ball.p4.normal[xIndex] * xSign, ball.p4.normal[yIndex] * ySign, ball.p4.normal[zIndex] * zSign, r, g, b, p5x, p5y, p5z, ball.p5.normal[xIndex] * xSign, ball.p5.normal[yIndex] * ySign, ball.p5.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p5x, p5y, p5z, ball.p5.normal[xIndex] * xSign, ball.p5.normal[yIndex] * ySign, ball.p5.normal[zIndex] * zSign, r, g, b, p1x, p1y, p1z, ball.p1.normal[xIndex] * xSign, ball.p1.normal[yIndex] * ySign, ball.p1.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b);
                }
                else {
                    triangles.push(p2x, p2y, p2z, ball.p2.normal[xIndex] * xSign, ball.p2.normal[yIndex] * ySign, ball.p2.normal[zIndex] * zSign, r, g, b, p1x, p1y, p1z, ball.p1.normal[xIndex] * xSign, ball.p1.normal[yIndex] * ySign, ball.p1.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p3x, p3y, p3z, ball.p3.normal[xIndex] * xSign, ball.p3.normal[yIndex] * ySign, ball.p3.normal[zIndex] * zSign, r, g, b, p2x, p2y, p2z, ball.p2.normal[xIndex] * xSign, ball.p2.normal[yIndex] * ySign, ball.p2.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p4x, p4y, p4z, ball.p4.normal[xIndex] * xSign, ball.p4.normal[yIndex] * ySign, ball.p4.normal[zIndex] * zSign, r, g, b, p3x, p3y, p3z, ball.p3.normal[xIndex] * xSign, ball.p3.normal[yIndex] * ySign, ball.p3.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p5x, p5y, p5z, ball.p5.normal[xIndex] * xSign, ball.p5.normal[yIndex] * ySign, ball.p5.normal[zIndex] * zSign, r, g, b, p4x, p4y, p4z, ball.p4.normal[xIndex] * xSign, ball.p4.normal[yIndex] * ySign, ball.p4.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b, p1x, p1y, p1z, ball.p1.normal[xIndex] * xSign, ball.p1.normal[yIndex] * ySign, ball.p1.normal[zIndex] * zSign, r, g, b, p5x, p5y, p5z, ball.p5.normal[xIndex] * xSign, ball.p5.normal[yIndex] * ySign, ball.p5.normal[zIndex] * zSign, r, g, b, pcx, pcy, pcz, ball.pc.normal[xIndex] * xSign, ball.pc.normal[yIndex] * ySign, ball.pc.normal[zIndex] * zSign, r, g, b);
                }
            }
        }
    }
}
function addEdgeSurface(triangles, vertex1, vertex2, left, right) {
    const r = 0.25;
    const g = 0.25;
    const b = 0.25;
    const p1x = vertex1[0] + left[0] / 96;
    const p1y = vertex1[1] + left[1] / 96;
    const p1z = vertex1[2] + left[2] / 96;
    const p2x = vertex1[0] + right[0] / 96;
    const p2y = vertex1[1] + right[1] / 96;
    const p2z = vertex1[2] + right[2] / 96;
    const p3x = vertex2[0] + left[0] / 96;
    const p3y = vertex2[1] + left[1] / 96;
    const p3z = vertex2[2] + left[2] / 96;
    const p4x = vertex2[0] + right[0] / 96;
    const p4y = vertex2[1] + right[1] / 96;
    const p4z = vertex2[2] + right[2] / 96;
    triangles.push(p1x, p1y, p1z, left[0], left[1], left[2], r, g, b, p2x, p2y, p2z, right[0], right[1], right[2], r, g, b, p3x, p3y, p3z, left[0], left[1], left[2], r, g, b, p3x, p3y, p3z, left[0], left[1], left[2], r, g, b, p2x, p2y, p2z, right[0], right[1], right[2], r, g, b, p4x, p4y, p4z, right[0], right[1], right[2], r, g, b);
}
function addEdge(triangles, cv, nv, mv, ov, vertex1, vertex2) {
    Vectors.sub(vertex2, vertex1, cv);
    if (Vectors.lengthSquared(cv) < 0.0035) {
        return;
    }
    Vectors.normalizeSelf(cv);
    Vectors.cross(vertex1, cv, nv);
    Vectors.normalizeSelf(nv);
    Vectors.cross(cv, nv, mv);
    Vectors.normalizeSelf(mv);
    Vectors.add(nv, mv, cv);
    Vectors.normalizeSelf(cv);
    Vectors.sub(mv, nv, ov);
    Vectors.normalizeSelf(ov);
    addEdgeSurface(triangles, vertex1, vertex2, nv, cv);
    addEdgeSurface(triangles, vertex1, vertex2, cv, mv);
    addEdgeSurface(triangles, vertex1, vertex2, mv, ov);
    Vectors.negateSelf(nv);
    addEdgeSurface(triangles, vertex1, vertex2, ov, nv);
    Vectors.negateSelf(cv);
    Vectors.negateSelf(mv);
    Vectors.negateSelf(ov);
    addEdgeSurface(triangles, vertex1, vertex2, nv, cv);
    addEdgeSurface(triangles, vertex1, vertex2, cv, mv);
    addEdgeSurface(triangles, vertex1, vertex2, mv, ov);
    Vectors.negateSelf(nv);
    addEdgeSurface(triangles, vertex1, vertex2, ov, nv);
}
function addPolygon(triangles, cv, nv, mv, vertexes, indexes, colorIndex) {
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
export function buildPolyhedronMesh(polyhedron, faceVisibility, visibilityType, vertexVisibility, edgeVisibility, evenOddFilling) {
    const triangles = [];
    const cv = [0, 0, 0];
    const nv = [0, 0, 0];
    const mv = [0, 0, 0];
    const ov = [0, 0, 0];
    const verfView = visibilityType === "VertexFigure";
    const eachForOne = visibilityType === "OneForEach";
    const refPointIndexes = [];
    if (verfView) {
        polyhedron.vertexes.forEach((vertex, i) => {
            if (Vectors.distanceSquared(vertex, polyhedron.vertexes[0]) < 0.005) {
                refPointIndexes.push(i);
            }
        });
    }
    else if (eachForOne) {
        refPointIndexes.push(0);
    }
    const colorDrawn = eachForOne ? new Set() : null;
    const polygons = [];
    const drawIndexes = [];
    let addedVertexCount = 0;
    for (let i = 0; i < polyhedron.faces.length; i++) {
        const face = polyhedron.faces[i];
        const colorIndex = Math.min(face.ColorIndex, faceColors.length - 1);
        if (!faceVisibility[colorIndex]) {
            continue;
        }
        if (colorDrawn) {
            if (colorDrawn.has(colorIndex)) {
                continue;
            }
            colorDrawn.add(colorIndex);
        }
        if (verfView && face.VertexIndexes.every(i => !refPointIndexes.includes(i))) {
            continue;
        }
        drawIndexes.push(i);
    }
    for (const i of drawIndexes) {
        const face = polyhedron.faces[i];
        const colorIndex = Math.min(face.ColorIndex, faceColors.length - 1);
        addPolygon(triangles, cv, nv, mv, polyhedron.vertexes, face.VertexIndexes, colorIndex);
        if (evenOddFilling) {
            const vertexCount = triangles.length / 9 - addedVertexCount;
            if (vertexCount > 0) {
                polygons.push({ vertexCount: triangles.length / 9 - addedVertexCount, stencilEnabled: true });
                addedVertexCount = triangles.length / 9;
            }
        }
    }
    if (vertexVisibility) {
        if (verfView) {
            addVertex(triangles, polyhedron.vertexes[0]);
        }
        else {
            for (const index of polyhedron.vertexIndexes) {
                addVertex(triangles, polyhedron.vertexes[index]);
            }
        }
    }
    if (edgeVisibility) {
        for (const [index1, index2] of polyhedron.lineIndexes) {
            if (verfView && !refPointIndexes.includes(index1) && !refPointIndexes.includes(index2)) {
                continue;
            }
            addEdge(triangles, cv, nv, mv, ov, polyhedron.vertexes[index1], polyhedron.vertexes[index2]);
        }
    }
    const remainingVertexCount = triangles.length / 9 - addedVertexCount;
    if (remainingVertexCount > 0) {
        polygons.push({ vertexCount: triangles.length / 9 - addedVertexCount, stencilEnabled: false });
    }
    return {
        vertexData: new Float32Array(triangles),
        polygons,
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
