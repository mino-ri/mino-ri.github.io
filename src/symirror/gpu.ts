/// <reference types="@webgpu/types" />

// 頂点シェーダー: MVP 変換を適用
// フラグメントシェーダー: flat shading
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
`

export interface PolyhedronMesh {
    // インターリーブ頂点データ: [x, y, z, nx, ny, nz, r, g, b] × 頂点数
    vertexData: Float32Array
    stencilVertexCounts: number[]
    normalVertexCount: number
}

export interface PolyhedronRenderer {
    updateMesh(mesh: PolyhedronMesh): void
    render(modelMatrix: Float32Array): void
    destroy(): void
}

export interface GpuContext {
    readonly device: GPUDevice
    readonly context: GPUCanvasContext
    readonly format: GPUTextureFormat
    createPolyhedronRenderer(): PolyhedronRenderer
}

export const initGpu = async (canvas: HTMLCanvasElement): Promise<GpuContext | null> => {
    if (!navigator.gpu) {
        console.error("WebGPU is not supported")
        return null
    }

    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) {
        console.error("Failed to get GPU adapter")
        return null
    }

    const device = await adapter.requestDevice()
    const context = canvas.getContext("webgpu")
    if (!context) {
        console.error("Failed to get WebGPU context")
        return null
    }

    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({
        device,
        format,
        alphaMode: "premultiplied",
    })

    return new GpuContextImpl(device, context, format)
}

class GpuContextImpl implements GpuContext {
    constructor(
        readonly device: GPUDevice,
        readonly context: GPUCanvasContext,
        readonly format: GPUTextureFormat,
    ) { }

    createPolyhedronRenderer(): PolyhedronRenderer {
        return new PolyhedronRendererImpl(this.device, this.context, this.format)
    }
}

// View-Projection 行列 (perspective + lookAt)
const viewProjectionMatrix = new Float32Array([
    4, 0, 0, 0,
    0, -4, 0, 0,
    0, 0, 1.75, 1,
    -0.009765625, 0.009765625, 3.5, 5,
])

const lightViewProjectionMatrix = new Float32Array([
    8.96319, 1.025915, 0.836241245, 0.163968876,
    0, -7.548099, 2.87967658, 0.5646425,
    -1.81692851, 5.06099749, 4.12530756, 0.808883846,
    -0.0178622864, 0.0178622864, 5.09999847, 9.2,
])

class PolyhedronRendererImpl implements PolyhedronRenderer {
    #pipeline: GPURenderPipeline
    #stencilWritePipeline: GPURenderPipeline
    #stencilMaskPipeline: GPURenderPipeline
    #shadowPipeline: GPURenderPipeline
    #shadowStencilWritePipeline: GPURenderPipeline
    #shadowStencilMaskPipeline: GPURenderPipeline
    #uniformBuffer: GPUBuffer
    #shadowBindGroup: GPUBindGroup
    #bindGroupLayout: GPUBindGroupLayout
    #bindGroup: GPUBindGroup
    #vertexBuffer: GPUBuffer | null = null
    #stencilVertexCounts: number[] = []
    #normalVertexCount = 0
    #depthTexture: GPUTexture | null = null
    #shadowTexture: GPUTexture
    #shadowSampler: GPUSampler
    #lastWidth = 0
    #lastHeight = 0
    #byteLength = 0
    #device: GPUDevice
    #context: GPUCanvasContext
    #format: GPUTextureFormat

    constructor(
        device: GPUDevice,
        context: GPUCanvasContext,
        format: GPUTextureFormat,
    ) {
        this.#device = device
        this.#context = context
        this.#format = format
        const shaderModule = device.createShaderModule({ code: shaderCode })

        const vertexBuferLayout: GPUVertexBufferLayout = {
            arrayStride: 9 * 4, // 9 floats per vertex
            attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
                { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
                { shaderLocation: 2, offset: 24, format: "float32x3" }, // color
            ],
        }

        this.#shadowSampler = device.createSampler({
            compare: 'less', // シェーダー内の textureSampleCompare で使用
            magFilter: 'linear',
            minFilter: 'linear',
        });

        // Uniform buffer: model matrix (64 bytes) + viewProjection matrix (64 bytes) + lightProjection matrix (64 bytes)
        this.#uniformBuffer = device.createBuffer({
            size: 64 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        const shadowBindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
            ],
        })
        this.#shadowBindGroup = this.#device.createBindGroup({
            layout: shadowBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
            ],
        })

        this.#bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
            ],
        })

        this.#shadowTexture = this.#device.createTexture({
            size: [2048, 2048],
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })

        this.#bindGroup = this.#device.createBindGroup({
            layout: this.#bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: this.#shadowTexture.createView({ aspect: "depth-only" }) },
                { binding: 2, resource: this.#shadowSampler },
            ],
        })

        const premitiveState: GPUPrimitiveState = {
            topology: "triangle-list",
            cullMode: "none",
            frontFace: "ccw",
        }
        const shadowLayout = device.createPipelineLayout({
            bindGroupLayouts: [shadowBindGroupLayout],
        })
        const shadowVertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: "vertexShadow",
            buffers: [vertexBuferLayout],
        }
        const ignoreDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilFront: { compare: "always", passOp: "keep" },
            stencilBack: { compare: "always", passOp: "keep" },
        }
        const readDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: true,
            depthCompare: "less",
            stencilFront: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
            stencilBack: { compare: "not-equal", passOp: "zero", depthFailOp: "zero" },
        }
        const writeDepthStencilState: GPUDepthStencilState = {
            format: "depth24plus-stencil8",
            depthWriteEnabled: false,
            depthCompare: "always",
            stencilFront: { compare: "always", passOp: "invert" },
            stencilBack: { compare: "always", passOp: "invert" },
        }
        this.#shadowPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: ignoreDepthStencilState,
        })
        this.#shadowStencilWritePipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        })
        this.#shadowStencilMaskPipeline = device.createRenderPipeline({
            layout: shadowLayout,
            vertex: shadowVertexState,
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        })

        const layout = device.createPipelineLayout({
            bindGroupLayouts: [this.#bindGroupLayout],
        })
        const vertexState: GPUVertexState = {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBuferLayout],
        }
        this.#pipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.#format }],
            },
            primitive: premitiveState,
            depthStencil: ignoreDepthStencilState,
        })
        this.#stencilWritePipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentEmpty",
                targets: [{ format: this.#format, writeMask: 0 }],
            },
            primitive: premitiveState,
            depthStencil: writeDepthStencilState,
        })
        this.#stencilMaskPipeline = device.createRenderPipeline({
            layout: layout,
            vertex: vertexState,
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.#format }],
            },
            primitive: premitiveState,
            depthStencil: readDepthStencilState,
        })

        this.#device.queue.writeBuffer(this.#uniformBuffer, 64, viewProjectionMatrix.buffer, viewProjectionMatrix.byteOffset, viewProjectionMatrix.byteLength)
        this.#device.queue.writeBuffer(this.#uniformBuffer, 128, lightViewProjectionMatrix.buffer, lightViewProjectionMatrix.byteOffset, lightViewProjectionMatrix.byteLength)
    }

    updateMesh(mesh: PolyhedronMesh): void {
        if (!this.#vertexBuffer || this.#byteLength < mesh.vertexData.byteLength) {
            this.#vertexBuffer?.destroy()
            this.#vertexBuffer = this.#device.createBuffer({
                size: mesh.vertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            })
            this.#byteLength = mesh.vertexData.byteLength
        }
        this.#device.queue.writeBuffer(this.#vertexBuffer, 0, mesh.vertexData.buffer, mesh.vertexData.byteOffset, mesh.vertexData.byteLength)
        this.#stencilVertexCounts = mesh.stencilVertexCounts
        this.#normalVertexCount = mesh.normalVertexCount
    }

    render(modelMatrix: Float32Array): void {
        if (!this.#vertexBuffer) {
            return
        }

        const canvas = this.#context.canvas as HTMLCanvasElement
        const width = canvas.width
        const height = canvas.height

        // Depth texture を必要に応じて再作成
        if (width !== this.#lastWidth || height !== this.#lastHeight) {
            if (this.#depthTexture) {
                this.#depthTexture.destroy()
            }
            this.#depthTexture = this.#device.createTexture({
                size: [width, height],
                format: "depth24plus-stencil8",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            })

            this.#lastWidth = width
            this.#lastHeight = height
        }

        // Update uniforms
        this.#device.queue.writeBuffer(this.#uniformBuffer, 0, modelMatrix.buffer, modelMatrix.byteOffset, modelMatrix.byteLength)

        const commandEncoder = this.#device.createCommandEncoder()
        const shadowTextureView = this.#shadowTexture.createView()
        const textureView = this.#context.getCurrentTexture().createView()

        let vertexIndex = 0
        if (this.#stencilVertexCounts.length > 0) {
            const shadowPass = commandEncoder.beginRenderPass({
                colorAttachments: [], // カラー出力なし
                depthStencilAttachment: {
                    view: shadowTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                    stencilClearValue: 0,
                    stencilLoadOp: "clear",
                    stencilStoreOp: "store",
                },
            })

            for (let i = 0; i < this.#stencilVertexCounts.length; i++) {
                const vertexCount = this.#stencilVertexCounts[i]!
                // ステンシル更新
                shadowPass.setPipeline(this.#shadowStencilWritePipeline)
                shadowPass.setBindGroup(0, this.#shadowBindGroup)
                shadowPass.setVertexBuffer(0, this.#vertexBuffer)
                shadowPass.draw(vertexCount, 1, vertexIndex)

                // 描画
                shadowPass.setPipeline(this.#shadowStencilMaskPipeline)
                shadowPass.setBindGroup(0, this.#shadowBindGroup)
                shadowPass.setVertexBuffer(0, this.#vertexBuffer)
                shadowPass.draw(vertexCount, 1, vertexIndex)
                vertexIndex += vertexCount
            }

            shadowPass.end()
        }

        if (this.#normalVertexCount > 0) {
            const shadowPass = commandEncoder.beginRenderPass({
                colorAttachments: [], // カラー出力なし
                depthStencilAttachment: {
                    view: shadowTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: this.#stencilVertexCounts.length === 0 ? "clear" : "load",
                    depthStoreOp: "store",
                    stencilReadOnly: true,
                },
            })

            // 描画
            shadowPass.setPipeline(this.#shadowPipeline)
            shadowPass.setBindGroup(0, this.#shadowBindGroup)
            shadowPass.setVertexBuffer(0, this.#vertexBuffer)
            shadowPass.draw(this.#normalVertexCount, 1, vertexIndex)
            shadowPass.end()
        }

        vertexIndex = 0
        if (this.#stencilVertexCounts.length > 0) {
            const mainPass = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: textureView,
                    clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                }],
                depthStencilAttachment: {
                    view: this.#depthTexture!.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                    stencilClearValue: 0,
                    stencilLoadOp: "clear",
                    stencilStoreOp: "store",
                },
            })

            for (let i = 0; i < this.#stencilVertexCounts.length; i++) {
                const vertexCount = this.#stencilVertexCounts[i]!
                // ステンシル更新
                mainPass.setPipeline(this.#stencilWritePipeline)
                mainPass.setBindGroup(0, this.#bindGroup)
                mainPass.setVertexBuffer(0, this.#vertexBuffer)
                mainPass.draw(vertexCount, 1, vertexIndex)
                // 描画
                mainPass.setPipeline(this.#stencilMaskPipeline)
                mainPass.setBindGroup(0, this.#bindGroup)
                mainPass.setVertexBuffer(0, this.#vertexBuffer)
                mainPass.draw(vertexCount, 1, vertexIndex)
                vertexIndex += vertexCount
            }

            mainPass.end()
        }

        const mainPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
                loadOp: this.#stencilVertexCounts.length === 0 ? "clear" : "load",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: this.#depthTexture!.createView(),
                depthClearValue: 1.0,
                depthLoadOp: this.#stencilVertexCounts.length === 0 ? "clear" : "load",
                depthStoreOp: "store",
                stencilReadOnly: true,
            },
        })

        if (this.#normalVertexCount > 0) {
            // 描画
            mainPass.setPipeline(this.#pipeline)
            mainPass.setBindGroup(0, this.#bindGroup)
            mainPass.setVertexBuffer(0, this.#vertexBuffer)
            mainPass.draw(this.#normalVertexCount, 1, vertexIndex)
        }
        mainPass.end()

        this.#device.queue.submit([commandEncoder.finish()])
    }

    destroy(): void {
        if (this.#vertexBuffer) {
            this.#vertexBuffer.destroy()
        }
        if (this.#depthTexture) {
            this.#depthTexture.destroy()
        }
        this.#uniformBuffer.destroy()
    }
}
