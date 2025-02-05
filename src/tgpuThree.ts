import * as TSL from 'three/tsl';
import * as THREE from 'three/webgpu';
import tgpu, { type TgpuBuffer, type TgpuComputeFn } from 'typegpu';
import * as d from 'typegpu/data';

const typeToTypedArray = {
  u32: Uint32Array,
  i32: Int32Array,
  f32: Float32Array,

  vec2u: Uint32Array,
  vec3u: Uint32Array,
  vec4u: Uint32Array,

  vec2i: Int32Array,
  vec3i: Int32Array,
  vec4i: Int32Array,

  vec2f: Float32Array,
  vec3f: Float32Array,
  vec4f: Float32Array,

  vec2h: Float32Array,
  vec3h: Float32Array,
  vec4h: Float32Array,
} as const;

export function getNodeForBuffer<T extends d.WgslArray | d.U32 | d.F32 | d.I32>(
  buffer: TgpuBuffer<T>,
  renderer: THREE.WebGPURenderer,
): {
  buffer: THREE.StorageBufferNode;
  attribute: THREE.StorageBufferAttribute;
} {
  const count = d.isWgslArray(buffer.dataType)
    ? buffer.dataType.elementCount
    : 1;

  const primitiveType = d.isWgslArray(buffer.dataType)
    ? buffer.dataType.elementType.type
    : buffer.dataType.type;
  if (!(primitiveType in typeToTypedArray)) {
    throw new Error(`Type ${primitiveType} is not supported`);
  }
  const TypedArray = typeToTypedArray[primitiveType];

  const attr = new THREE.StorageBufferAttribute(count, 4);
  const node = TSL.storage(attr);

  // Swap out buffer Indiana Jones style
  const backend = renderer.backend;
  // @ts-ignore: <Proxy magic>
  const data = backend.get(attr);
  data.buffer = buffer.buffer;
  attr.needsUpdate = true;

  return {
    buffer: node,
    attribute: attr,
  };
}

export async function boundComputeToNode(
  fn: TgpuComputeFn,
  buffers: THREE.StorageBufferNode[],
  renderer: THREE.WebGPURenderer,
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  externalBindGroup: GPUBindGroup,
  externalLayout: GPUBindGroupLayout,
): Promise<{
  computeNode: THREE.ComputeNode;
  codeNode: THREE.CodeNode;
}> {
  if (!renderer._initialized) {
    await renderer.init();
  }
  const code = tgpu.resolve({
    externals: { fn },
  });
  const codeNode = TSL.wgsl(code, buffers);
  const c = codeNode.compute(24);
  const data = renderer._nodes.getForCompute(c);
  data.computeShader = code;
  const module = device.createShaderModule({
    code,
  });
  // @ts-ignore: <Initialize cache to later hijack pipeline>
  renderer._pipelines.programs.compute.set(code, module);

  // @ts-ignore: <Cache hijacking>
  const cacheKey = renderer._pipelines._getComputeCacheKey(c, module);
  const injectionPipeline = {
    isComputePipeline: true,
    computeProgram: module,
    cacheKey,
    usedTimes: 0,
  };
  renderer._pipelines.caches.set(cacheKey, injectionPipeline);
  // @ts-ignore: <Proxy magic>
  const pipelineGpu = renderer.backend.get(injectionPipeline);
  pipelineGpu.pipeline = pipeline;

  const bindGroup = data.bindings[0];
  // @ts-ignore: <Backend is WebGPUBackend so the method is there>
  renderer.backend.createBindings(bindGroup, null, 0);

  // @ts-ignore: <Proxy magic>
  const internal = renderer.backend.get(bindGroup);
  internal.group = externalBindGroup;
  internal.layout = externalLayout;
  // @ts-ignore: <Swap out bindGroup>
  renderer._bindings.get(bindGroup).bindGroup = externalBindGroup;

  return {
    computeNode: c,
    codeNode: codeNode,
  };
}
