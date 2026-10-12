import type { CameraSettings } from '../../shared/cameraProtocol';

// Original single-pass shader: key the unadjusted source in chroma space, then
// suppress green spill and apply color correction. Output premultiplied alpha.
const vertex = `#version 300 es
in vec2 position;
out vec2 uv;
void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0., 1.); }`;
const fragment = `#version 300 es
precision mediump float;
uniform sampler2D source;
uniform bool keyEnabled;
uniform bool mirror;
uniform float tolerance;
uniform float softness;
uniform float brightness;
uniform float contrast;
in vec2 uv;
out vec4 color;
vec2 chroma(vec3 c) {
  return vec2(dot(c, vec3(-0.168736, -0.331264, 0.5)),
              dot(c, vec3(0.5, -0.418688, -0.081312)));
}
void main() {
  vec3 rgb = texture(source, vec2(mirror ? 1. - uv.x : uv.x, 1. - uv.y)).rgb;
  float alpha = 1.;
  if (keyEnabled) {
    float distanceToGreen = distance(chroma(rgb), chroma(vec3(0., 1., 0.)));
    alpha = smoothstep(tolerance, tolerance + softness, distanceToGreen);
    float spill = max(0., rgb.g - max(rgb.r, rgb.b));
    rgb.g -= spill * (1. - smoothstep(tolerance + softness, tolerance + softness + 0.2, distanceToGreen));
  }
  rgb = clamp((rgb - 0.5) * contrast + 0.5 + brightness, 0., 1.);
  color = vec4(rgb * alpha, alpha);
}`;

export class CameraEffects {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private buffer: WebGLBuffer;
  private locations: Record<string, WebGLUniformLocation | null> = {};
  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
    if (!gl) throw new Error('WebGL2 is unavailable. Enable hardware acceleration and retry the camera.');
    this.gl = gl;
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    if (!program || !texture || !buffer) {
      gl.deleteProgram(program); gl.deleteTexture(texture); gl.deleteBuffer(buffer);
      throw new Error('Camera graphics resources are unavailable.');
    }
    this.program = program; this.texture = texture; this.buffer = buffer;
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Camera shader could not be created.');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Camera shader failed to compile.');
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Camera shader failed to link.');
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      for (const name of ['source', 'keyEnabled', 'mirror', 'tolerance', 'softness', 'brightness', 'contrast']) this.locations[name] = gl.getUniformLocation(program, name);
      gl.uniform1i(this.locations.source, 0);
    } catch (error) { this.dispose(); throw error; }
    finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  draw(video: HTMLVideoElement, settings: CameraSettings): void {
    const gl = this.gl;
    if (gl.isContextLost()) throw new Error('Camera graphics context was lost. Turn camera off and on to retry.');
    if (video.readyState < 2 || !video.videoWidth) return;
    if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
      this.canvas.width = video.videoWidth; this.canvas.height = video.videoHeight;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(this.locations.keyEnabled, Number(settings.chromaKey));
    gl.uniform1i(this.locations.mirror, Number(settings.mirror));
    for (const key of ['tolerance', 'softness', 'brightness', 'contrast'] as const) gl.uniform1f(this.locations[key], settings[key]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  dispose(): void {
    this.gl.deleteTexture(this.texture); this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program);
  }
}
