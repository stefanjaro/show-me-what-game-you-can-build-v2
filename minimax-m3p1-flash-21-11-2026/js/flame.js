/* EMBERWAKE — the flame: a domain-warped noise shader on a fullscreen quad.
   Rendered onto its own (lower-resolution) canvas which is screen-blended over the
   room, so the light of the flame spills onto the architecture like real lamplight. */
(function (global) {
  'use strict';

  var VS = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uCenter;',
    'uniform float uScale;',
    'uniform float uLight;',
    'uniform float uPulse;',
    'uniform float uGutter;',
    'uniform float uTilt;',
    'uniform float uDawn;',
    'uniform float uShake;',
    '',
    'float hash(vec2 p){',
    '  p = fract(p*vec2(123.34, 456.21));',
    '  p += dot(p, p+45.32);',
    '  return fract(p.x*p.y);',
    '}',
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash(i), b = hash(i+vec2(1.0,0.0));',
    '  float c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 0.55;',
    '  for(int i=0;i<3;i++){ s += a*noise(p); p = p*2.07 + vec2(11.7, 3.1); a *= 0.48; }',
    '  return s;',
    '}',
    '',
    'float flameMask(vec2 p, float wMul, float speed, float det){',
    '  float n1 = fbm(vec2(p.x*2.35, p.y*1.25 - uTime*1.15*speed));',
    '  float n2 = fbm(vec2(p.x*6.10 + n1*3.6, p.y*2.90 - uTime*2.45*speed));',
    '  float n3 = noise(vec2(p.x*14.0 - uTime*3.4, p.y*7.5 - uTime*5.4));',
    '  float sway = (n1-0.5)*1.05*(0.05 + p.y*1.15);',
    '  float x = p.x - sway + uTilt*0.30*(0.20+p.y) + uShake*sin(uTime*38.0)*(0.25+p.y);',
    '  float y = p.y;',
    '  float w = pow(max(0.0, 1.0-y), 0.95) * (0.255*wMul + 0.150*n2) * (0.90+0.20*det) * (0.97 + 0.06*n3*det);',
    '  float d = abs(x) - w;',
    '  float m = 1.0 - smoothstep(-0.012, 0.048, d);',
    '  m *= 1.0 - smoothstep(0.42, 1.34, y + (n1-0.5)*0.62);',
    '  m *= smoothstep(-0.07, 0.045, y);',
    '  return clamp(m, 0.0, 1.0);',
    '}',
    '',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2  p  = vec2((frag.x - uCenter.x)/uScale, (frag.y - uCenter.y)/uScale);',
    '',
    '  float gut = 1.0 - uGutter*0.78;',
    '  float lit = uLight*gut;',
    '  float breathe = 0.86 + 0.14*sin(uTime*2.1) + uPulse*0.5;',
    '',
    '  float d = length(vec2(p.x*1.30, (p.y-0.22)*0.86));',
    '',
    '  vec3 col = vec3(0.0);',
    '',
    '  if (d < 2.05) {',
    '    float outer = flameMask(p, 1.0, 1.0, 1.0);',
    '    float inner = flameMask(vec2(p.x, p.y*1.12-0.010), 0.40, 1.7, 0.0);',
    '',
    '    vec3 body = mix(vec3(0.72,0.10,0.02), vec3(1.00,0.44,0.06), smoothstep(0.0,0.55,outer));',
    '    body = mix(body, vec3(1.00,0.82,0.38), smoothstep(0.14,0.78,inner));',
    '    body = mix(body, vec3(1.00,0.99,0.96), smoothstep(0.58,1.00,inner*inner));',
    '    body = mix(body, vec3(0.78,0.88,1.00), uDawn*0.32);',
    '',
    '    col += body * outer * lit * breathe;',
    '    col += vec3(1.0,0.94,0.80) * inner*inner * lit * breathe * 0.58;',
    '',
    '    // blue gas ring at the base',
    '    float base = exp(-220.0*pow(p.y-0.005,2.0)) * exp(-90.0*p.x*p.x);',
    '    col += vec3(0.16,0.40,0.72)*base*lit*0.40;',
    '  }',
    '',
    '  // volumetric halo',
    '  float halo = exp(-2.45*d) * (0.28 + 0.72*lit) * lit;',
    '  halo += exp(-6.0*d) * lit * 0.60;',
    '  vec3 haloCol = mix(vec3(1.00,0.50,0.15), vec3(1.00,0.80,0.45), lit*0.7);',
    '  haloCol = mix(haloCol, vec3(1.0,0.86,0.66), uDawn*0.6);',
    '  col += haloCol * halo * 1.05;',
    '',
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  var gl = null, canvas = null, prog = null, uni = {}, buf = null;
  var ok = false;
  var SCALE = 0.5;            // render the flame at half resolution — it is all soft light

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('flame shader: ' + gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function init(cv) {
    canvas = cv;
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
    try { gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts); }
    catch (e) { gl = null; }
    if (!gl) return false;
    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { gl = null; return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('flame link: ' + gl.getProgramInfoLog(prog));
      gl = null; return false;
    }
    gl.useProgram(prog);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uCenter', 'uScale', 'uLight', 'uPulse', 'uGutter', 'uTilt', 'uDawn', 'uShake'].forEach(function (n) {
      uni[n] = gl.getUniformLocation(prog, n);
    });
    ok = true;
    resize();
    return true;
  }

  function resize() {
    if (!ok || !canvas) return;
    var w = Math.max(2, Math.round(canvas.clientWidth * SCALE));
    var h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
  }

  function render(t, s) {
    if (!ok) return;
    resize();
    var w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.uniform2f(uni.uRes, w, h);
    gl.uniform1f(uni.uTime, t);
    // the framebuffer's origin is bottom-left, so the flame base is at (cssH - baseY)
    gl.uniform2f(uni.uCenter, s.cx * (w / s.cssW), (s.cssH - s.baseY) * (h / s.cssH));
    gl.uniform1f(uni.uScale, s.scale * (h / s.cssH));
    gl.uniform1f(uni.uLight, s.light);
    gl.uniform1f(uni.uPulse, s.pulse);
    gl.uniform1f(uni.uGutter, s.gutter);
    gl.uniform1f(uni.uTilt, s.tilt);
    gl.uniform1f(uni.uDawn, s.dawn);
    gl.uniform1f(uni.uShake, s.shake);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  global.Flame = {
    init: init,
    render: render,
    resize: resize,
    get ok() { return ok; }
  };
})(window);
