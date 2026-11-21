'use strict';
/* =========================================================
   UNDERGROWTH - Voxel Engine (WebGL2, written from scratch)
   ========================================================= */

const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
};

const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      o[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = new Float32Array(16);
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m;
  },
  lookAt(e, c, u) {
    const z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(u, z)), y = V3.cross(z, x);
    const m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -V3.dot(x, e); m[13] = -V3.dot(y, e); m[14] = -V3.dot(z, e); m[15] = 1; return m;
  },
  T(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  S(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  RY(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  RX(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  RZ(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  invert(m) {
    const inv = new Float32Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  },
  xform(m, v) {
    const x = v[0], y = v[1], z = v[2], w = v[3] === undefined ? 1 : v[3];
    return [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w,
      m[2] * x + m[6] * y + m[10] * z + m[14] * w, m[3] * x + m[7] * y + m[11] * z + m[15] * w];
  }
};

/* ---------------- Shaders ---------------- */
const VS_MAIN = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in vec2 aUV;
layout(location=4) in float aAO;
layout(location=5) in float aPat;
uniform mat4 uVP, uLVP, uModel;
out vec3 vW; out vec3 vN; out vec3 vC; out vec2 vUV; out float vAO; flat out float vPat; out vec4 vLP; out vec3 vL;
void main(){
  vec4 w = uModel*vec4(aPos,1.0);
  vW = w.xyz; vN = normalize(mat3(uModel)*aNrm); vC = aCol; vUV = aUV; vAO = aAO; vPat = aPat;
  vL = aPos;
  vLP = uLVP*w;
  gl_Position = uVP*w;
}`;

const FS_MAIN = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN; in vec3 vC; in vec2 vUV; in float vAO; flat in float vPat; in vec4 vLP; in vec3 vL;
uniform vec3 uSun, uSunCol, uSky, uGround, uFogCol, uCam;
uniform float uFogN, uFogF, uCut, uTime, uAmb, uExpo, uFadeY;
uniform vec4 uFade; uniform vec2 uRes;
uniform vec4 uTint; uniform vec4 uEmit;
uniform sampler2D uShadow; uniform int uShadowOn; uniform float uShTex;
uniform vec4 uLP[10]; uniform vec4 uLC[10];
uniform int uTrans;
out vec4 o;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ return h21(p.xy+p.z*17.13); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float shadowF(){
  vec3 p = vLP.xyz/vLP.w*0.5+0.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  float s=0.; float b=0.0009;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
    float d=texture(uShadow,p.xy+vec2(float(i),float(j))*uShTex).r; s += (p.z-b>d)?0.:1.; }
  return s/9.;
}
void main(){
  float pat = vPat; bool cut=false;
  if(pat>=99.5){ cut=true; pat-=100.; }
  if(cut && vW.y>uCut+0.02) discard;
  if(cut && (abs(pat-11.)<0.5||abs(pat-19.)<0.5) && length(vW-uCam) < 1.8) discard;
  if(cut && uFade.w > 0.0 && vW.y > uFadeY){
    vec2 sc = gl_FragCoord.xy/uRes; vec2 dd = (sc-uFade.xy)*vec2(uRes.x/uRes.y,1.0); float dc = length(dd);
    if(dc < uFade.w && length(vW-uCam) < uFade.z - 1.0){
      float th = fract(sin(dot(floor(gl_FragCoord.xy*0.5),vec2(12.9898,78.233)))*43758.5453);
      if(th < 0.88*smoothstep(uFade.w, uFade.w*0.55, dc)) discard;
    }
  }
  vec3 n = normalize(vN);
  vec3 base = vC*uTint.rgb;
  float alpha = 1.0; float emis = 0.0;
  vec2 uv = vUV; vec2 fu = fract(uv); vec2 tx = floor(fu*16.)/16.;
  vec3 blk = floor(vW - n*0.5 + 0.001);
  float bh = h31(blk);
  float tn = h21(tx*31.7+blk.xz*1.37+blk.y*3.1);
  if(pat<-0.5){ // entity: soft gradient
    base *= 0.92+0.08*clamp(vL.y+0.5,0.,1.);
  } else if(pat<0.5){ // plain textured
    base *= 0.9+0.12*tn;
  } else if(pat<1.5){ // brick
    float row=floor(fu.y*4.); float off=mod(row,2.)*0.25;
    float bx=fract(fu.x*2.+off); float by=fract(fu.y*4.);
    float mort = (by<0.14||bx<0.07)?1.:0.;
    base = mix(base*(0.82+0.25*h21(vec2(floor(fu.x*2.+off),row)+blk.xz)), vec3(0.75,0.72,0.66), mort*0.85);
    base *= 0.93+0.08*tn;
  } else if(pat<2.5){ // planks
    float row=floor(fu.y*4.); float g=h21(vec2(row,blk.x+blk.z*3.));
    base *= 0.8+0.25*g; base*=0.92+0.1*vn(vec2(fu.x*24.,row*7.));
    if(fract(fu.y*4.)<0.08) base*=0.7;
  } else if(pat<3.5){ // tile checker
    float c = mod(floor(fu.x*2.)+floor(fu.y*2.),2.);
    base *= 0.82+0.22*c; if(fract(fu.x*2.)<0.05||fract(fu.y*2.)<0.05) base*=0.8; base*=0.96+0.06*tn;
  } else if(pat<4.5){ // marble
    float v = vn(vW.xz*1.3+vW.y*0.7)+0.5*vn(vW.zy*3.1+vW.x);
    base *= 0.93+0.07*tn; base = mix(base, base*0.7, smoothstep(0.62,0.68,fract(v*2.3))*0.6);
  } else if(pat<5.5){ // grass
    if(n.y>0.5){ base *= 0.82+0.3*tn; }
    else { vec3 dirt=vec3(0.45,0.31,0.19)*(0.85+0.2*tn); base = (fu.y>0.8 - 0.1*h21(vec2(tx.x*9.,blk.x)))? base*(0.85+0.2*tn) : dirt; }
  } else if(pat<6.5){ // glass
    float e = (fu.x<0.06||fu.x>0.94||fu.y<0.06||fu.y>0.94)?1.:0.;
    if(abs(n.y)>0.5) e=0.;
    base = mix(base, vec3(0.85,0.88,0.9), e); alpha = mix(0.32, 1.0, e);
    float st = smoothstep(0.0,0.05,abs(fract((fu.x+fu.y)*1.5+0.2)-0.5)-0.38); base += st*0.15;
  } else if(pat<7.5){ // carpet
    base *= 0.9+0.12*tn; vec2 g=fract(vW.xz*0.5); if(abs(g.x-0.5)<0.04||abs(g.y-0.5)<0.04) base*=1.18;
  } else if(pat<8.5){ // roof tiles
    float row=floor(fu.y*4.); float sx=fract(fu.x*4.+mod(row,2.)*0.5);
    float edge = fract(fu.y*4.); base *= 0.8+0.25*edge; base*= 0.9+0.15*h21(vec2(floor(fu.x*4.),row)+blk.xz);
  } else if(pat<9.5){ // metal
    base *= 0.85+0.1*vn(vec2(fu.x*40.,fu.y*2.)) + 0.12*pow(max(dot(reflect(normalize(vW-uCam),n),uSun),0.),12.);
  } else if(pat<10.5){ // water
    float w1=vn(vW.xz*1.6+uTime*0.6), w2=vn(vW.xz*3.1-uTime*0.4);
    base *= 0.85+0.3*(w1*0.6+w2*0.4); alpha=0.78;
    base += vec3(0.25)*pow(max(dot(reflect(normalize(vW-uCam),n),uSun),0.),40.)*1.5;
  } else if(pat<11.5){ // leaves
    if(tn<0.12) discard; base *= 0.7+0.4*tn;
  } else if(pat<12.5){ // asphalt
    base *= 0.85+0.25*tn; if(n.y>0.5 && abs(fract(vW.z*0.5+0.0)-0.5)<0.03 && fract(vW.x*0.25)<0.5 && mod(floor(vW.z),8.)==0.) base=vec3(0.9,0.85,0.5);
  } else if(pat<13.5){ // neon / emissive
    base *= 1.0+0.2*sin(uTime*3.+bh*6.); emis = 1.0;
  } else if(pat<14.5){ // skyscraper windows
    float wx=fract(fu.x*2.), wy=fract(fu.y*2.); bool win = wx>0.15&&wx<0.85&&wy>0.2&&wy<0.85&&abs(n.y)<0.5;
    float lit = step(0.45,h21(floor(vec2(uv.x*2.,uv.y*2.))+blk.xz*0.37));
    if(win){ base = mix(vec3(0.12,0.16,0.22), vec3(1.,0.85,0.55), lit*0.9); emis = lit*0.85; }
  } else if(pat<15.5){ // stripes awning
    base = mix(base, vec3(0.95), step(0.5,fract(fu.x*2.)));
  } else if(pat<16.5){ // railing cutout
    bool bar = fract(fu.x*3.)<0.22 || fu.y>0.85 || abs(n.y)>0.5;
    if(!bar) discard;
  } else if(pat<17.5){ // lamp warm emissive
    emis = 1.0; base *= 0.9+0.1*tn;
  } else if(pat<18.5){ // sand
    base *= 0.92+0.1*tn + 0.04*vn(vW.xz*0.8);
  } else if(pat<19.5){ // plant blades (crossed quads)
    float cl = floor(vUV.x*7.); float hg = 0.4+0.6*h21(vec2(cl*1.7, floor(vW.x)+floor(vW.z)*7.));
    float v = fract(vUV.y+0.0001); if(vUV.y>0.999) v=1.;
    if(v > hg || abs(fract(vUV.x*7.)-0.5) > 0.46-v*0.36) discard;
    base *= 0.62+0.5*v+0.08*tn;
  }
  bool co = (pat>10.5&&pat<11.5)||(pat>15.5&&pat<16.5)||(pat>18.5&&pat<19.5);
  if(!gl_FrontFacing && co) n=-n;
  if(!gl_FrontFacing && uTrans==0 && !co && pat > -0.5){ o = vec4(base*0.28*vec3(0.9,0.95,1.0),1.); return; }
  vec3 amb = max(mix(uGround, uSky, n.y*0.5+0.5)*uAmb, vec3(0.30,0.30,0.33)*clamp(uAmb*1.3-0.05,0.0,1.0));
  float sh = uShadowOn==1 ? shadowF() : 1.0;
  float dif = max(dot(n,uSun),0.);
  float ao = vAO;
  vec3 pl = vec3(0.);
  for(int i=0;i<10;i++){
    vec3 d = uLP[i].xyz - vW; float r=uLP[i].w; if(r<=0.) continue;
    float dl = length(d); float a = clamp(1.-dl/r,0.,1.); a*=a;
    pl += uLC[i].rgb * a * (0.45+0.55*max(dot(n,d/max(dl,0.001)),0.)) * 1.5;
  }
  vec3 col = base*(amb*ao + uSunCol*dif*sh*(0.55+0.45*ao) + pl*ao);
  col = mix(col, base*1.25, emis);
  col += uEmit.rgb*uEmit.a;
  float dist = length(vW-uCam);
  float f = clamp((dist-uFogN)/(uFogF-uFogN),0.,1.);
  col = mix(col, uFogCol, f*f);
  col *= uExpo;
  col = col/(1.0+col*0.18);
  col = pow(max(col, vec3(0.0)), vec3(0.88));
  o = vec4(col, alpha*uTint.a);
}`;

const VS_DEPTH = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=5) in float aPat;
uniform mat4 uLVP, uModel;
flat out float vPat; out vec3 vW;
void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vPat=aPat; gl_Position=uLVP*w; }`;
const FS_DEPTH = `#version 300 es
precision mediump float;
flat in float vPat; in vec3 vW;
void main(){ }`;

const VS_SKY = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vP;
void main(){ vP=aP; gl_Position=vec4(aP,0.999,1.); }`;
const FS_SKY = `#version 300 es
precision mediump float;
in vec2 vP; uniform vec3 uTop, uBot, uSunScr; uniform float uTime; uniform int uNight;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  float t = clamp(vP.y*0.5+0.5,0.,1.);
  vec3 c = mix(uBot,uTop,pow(t,0.8));
  if(uNight==1){ vec2 g=floor(gl_FragCoord.xy/2.); float s=h(g); if(s>0.996) c+=vec3(0.8)*(0.5+0.5*sin(uTime*2.+s*90.)); }
  o=vec4(c,1.);
}`;

/* ---------------- Renderer ---------------- */
const Engine = {
  gl: null, canvas: null, progs: {}, worldMesh: null, transMesh: null, cube: null,
  shadowFB: null, shadowTex: null, shadowSize: 2048, quality: 'high',
  cam: { yaw: 0.7, pitch: 0.95, dist: 22, tx: 0, ty: 0, tz: 0, fov: 0.75 },
  view: null, proj: null, vp: null, lvp: null, eye: [0, 0, 0], shakeAmt: 0, exposure: 1.2,
  env: null, cut: 999, time: 0, lights: [],
  queue: [], // entity boxes this frame

  init(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!gl) { throw new Error('WebGL2 not supported'); }
    this.gl = gl;
    this.progs.main = this.prog(VS_MAIN, FS_MAIN);
    this.progs.depth = this.prog(VS_DEPTH, FS_DEPTH);
    this.progs.sky = this.prog(VS_SKY, FS_SKY);
    this.hardCube = this.makeCube();
    { const rb = LowPoly.roundBox(5, 0.42); this.cube = this.makeVAO(rb.v, rb.i); }
    const sq = gl.createVertexArray(); gl.bindVertexArray(sq);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.skyVAO = sq; gl.bindVertexArray(null);
    this.makeShadow();
    this.setEnv(null);
  },
  prog(vs, fs) {
    const gl = this.gl;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); const nm = inf.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, inf.name); }
    return { p, u };
  },
  makeShadow() {
    const gl = this.gl, s = this.shadowSize;
    this.shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, s, s, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  },
  makeVAO(data, idx) {
    const gl = this.gl; const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const st = 13 * 4;
    const at = (l, n, off) => { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, off * 4); };
    at(0, 3, 0); at(1, 3, 3); at(2, 3, 6); at(3, 2, 9); at(4, 1, 11); at(5, 1, 12);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, vb, ib, count: idx.length };
  },
  freeMesh(m) { if (!m) return; const gl = this.gl; gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib); },
  makeCube() {
    // unit cube centered at origin
    const F = [
      [[1, 0, 0], [[.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5], [.5, -.5, .5]]],
      [[-1, 0, 0], [[-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5], [-.5, -.5, -.5]]],
      [[0, 1, 0], [[-.5, .5, -.5], [-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5]]],
      [[0, -1, 0], [[-.5, -.5, .5], [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5]]],
      [[0, 0, 1], [[.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5], [-.5, -.5, .5]]],
      [[0, 0, -1], [[-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5], [.5, -.5, -.5]]]
    ];
    const v = [], ix = [];
    F.forEach((f, fi) => {
      f[1].forEach((p, k) => { v.push(p[0], p[1], p[2], f[0][0], f[0][1], f[0][2], 1, 1, 1, [0, 0, 1, 1][k], [0, 1, 1, 0][k], 1, -1); });
      const b = fi * 4; ix.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    return this.makeVAO(new Float32Array(v), new Uint16Array(ix));
  },

  /* ---- Voxel mesher ---- */
  buildWorld(world) {
    if (this.chunks) for (const c of this.chunks.values()) { this.freeMesh(c.o); this.freeMesh(c.t); }
    this.chunks = new Map(); this.dirty = new Set(); this.world = world;
    const CS = this.CS = 16, nx = Math.ceil(world.W / CS), nz = Math.ceil(world.D / CS);
    let n = 0;
    for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) n += this.buildChunk(cx, cz);
    return n;
  },
  markDirty(x, z) {
    if (!this.chunks) return;
    const CS = this.CS, cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    this.dirty.add(cx + ',' + cz);
    const lx = x - cx * CS, lz = z - cz * CS;
    if (lx === 0) this.dirty.add((cx - 1) + ',' + cz); if (lx === CS - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (lz === 0) this.dirty.add(cx + ',' + (cz - 1)); if (lz === CS - 1) this.dirty.add(cx + ',' + (cz + 1));
  },
  flushDirty(max) {
    if (!this.dirty || !this.dirty.size) return;
    let k = 0;
    for (const key of [...this.dirty]) { this.dirty.delete(key); const [cx, cz] = key.split(',').map(Number); if (cx >= 0 && cz >= 0) this.buildChunk(cx, cz); if (++k >= (max || 3)) break; }
  },
  buildChunk(cx, cz) {
    const world = this.world, key = cx + ',' + cz, prev = this.chunks.get(key);
    if (prev) { this.freeMesh(prev.o); this.freeMesh(prev.t); this.chunks.delete(key); }
    const W = world.W, H = world.H, D = world.D, b = world.b, cutA = world.cutF;
    const X0 = cx * this.CS, Z0 = cz * this.CS, X1 = Math.min(W, X0 + this.CS), Z1 = Math.min(D, Z0 + this.CS);
    if (X0 >= W || Z0 >= D) return 0;
    const BL = BLOCKS;
    const op = new Uint8Array(BL.length), tr = new Uint8Array(BL.length);
    for (let i = 1; i < BL.length; i++) { if (!BL[i]) continue; op[i] = BL[i].trans || BL[i].cutout ? 0 : 1; tr[i] = BL[i].trans ? 1 : 0; }
    const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ? (y < 0 ? 1 : 0) : b[(y * D + z) * W + x];
    const solidAO = (x, y, z) => { const t = get(x, y, z); return t && op[t] ? 1 : 0; };
    const dirs = [
      { n: [1, 0, 0], a: 2, bb: 1 }, { n: [-1, 0, 0], a: 2, bb: 1 },
      { n: [0, 1, 0], a: 0, bb: 2 }, { n: [0, -1, 0], a: 0, bb: 2 },
      { n: [0, 0, 1], a: 0, bb: 1 }, { n: [0, 0, -1], a: 0, bb: 1 }
    ];
    const aoV = [0.42, 0.62, 0.8, 1.0];
    const out = { o: { v: [], i: [], n: 0 }, t: { v: [], i: [], n: 0 } };
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const yMax = world.topY ? Math.min(H, world.topY + 2) : H;
    const Hn = world.Hn, treeCell = world.treeCell, WATERB = B.WATER;
    const LEAFB = this._leafB || (this._leafB = (() => { const a = new Uint8Array(BL.length); for (const k of ['LEAVES', 'LEAVES_D', 'LEAVES_L', 'PALM']) a[B[k]] = 1; return a; })());
    for (let y = 0; y < yMax; y++) for (let z = Z0; z < Z1; z++) for (let x = X0; x < X1; x++) {
      const t = b[(y * D + z) * W + x]; if (!t) continue;
      const bd = BL[t]; const isT = tr[t];
      if (Hn) {
        // smooth terrain replaces the ground voxels; trees and bushes are drawn as low-poly models
        if (y <= Hn[z * W + x] && t !== WATERB && !bd.soft) continue;
        if (treeCell[(y * D + z) * W + x] && !bd.cross) continue;
        if (LEAFB[t]) { LowPoly.bush(world, x, y, z, out.o); continue; }
      }
      const cutflag = cutA[(y * D + z) * W + x] ? 100 : 0;
      // color jitter per block
      let hsh = ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0; hsh = (hsh % 1000) / 1000;
      const jit = 1 + (hsh - 0.5) * (bd.jit === undefined ? 0.08 : bd.jit);
      const cr = bd.col[0] * jit, cg = bd.col[1] * jit, cb = bd.col[2] * jit;
      if (bd.cross) {
        const tg = out.o, h = bd.cross, o1 = (hsh - 0.5) * 0.3;
        const onG = Hn && y - 1 <= Hn[z * W + x];
        const gy = (px, pz) => onG ? LowPoly.surfH(world, px, pz) - 0.05 : y;
        for (const q of [[0, 0, 1, 1], [1, 0, 0, 1]]) {
          const b0 = tg.n, x0 = x + q[0] * 0.9 + 0.05 + o1 * 0.3, z0 = z + q[1] * 0.9 + 0.05, x1 = x + q[2] * 0.9 + 0.05, z1 = z + q[3] * 0.9 + 0.05 - o1 * 0.3;
          const br = bd.tip ? 0.2 : cr, bg = bd.tip ? 0.42 : cg, bb = bd.tip ? 0.14 : cb;
          const y0 = gy(x0, z0), y1 = gy(x1, z1);
          tg.v.push(x0, y0, z0, 0, 1, 0, br, bg, bb, 0, 0, 0.75, bd.pat + cutflag);
          tg.v.push(x1, y1, z1, 0, 1, 0, br, bg, bb, 1, 0, 0.75, bd.pat + cutflag);
          tg.v.push(x1, y1 + h, z1, 0, 1, 0, cr, cg, cb, 1, 1, 1, bd.pat + cutflag);
          tg.v.push(x0, y0 + h, z0, 0, 1, 0, cr, cg, cb, 0, 1, 1, bd.pat + cutflag);
          tg.n += 4; tg.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        }
        continue;
      }
      for (let d = 0; d < 6; d++) {
        const dir = dirs[d], n = dir.n;
        const nx = x + n[0], ny = y + n[1], nz = z + n[2];
        const nt = get(nx, ny, nz);
        if (isT) { if (nt && (nt === t || op[nt])) continue; }
        else { if (nt && op[nt]) continue; if (nt === t && bd.cutout) continue; }
        if (y === 0 && n[1] === -1) continue;
        const tgt = isT ? out.t : out.o;
        const ax = dir.a, bx = dir.bb; // tangent axes
        const base = tgt.n;
        const aos = [];
        for (let k = 0; k < 4; k++) {
          const ca = corners[k][0], cb2 = corners[k][1];
          const p = [x, y, z];
          // face plane
          const nAxis = n[0] ? 0 : n[1] ? 1 : 2;
          p[nAxis] += n[nAxis] > 0 ? 1 : 0;
          p[ax] += ca; p[bx] += cb2;
          // AO
          const sa = ca ? 1 : -1, sb = cb2 ? 1 : -1;
          const o1 = [nx, ny, nz]; o1[ax] += sa;
          const o2 = [nx, ny, nz]; o2[bx] += sb;
          const o3 = [nx, ny, nz]; o3[ax] += sa; o3[bx] += sb;
          const s1 = solidAO(o1[0], o1[1], o1[2]), s2 = solidAO(o2[0], o2[1], o2[2]), c = solidAO(o3[0], o3[1], o3[2]);
          const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + c);
          aos.push(ao);
          let u, v;
          if (nAxis === 1) { u = p[0]; v = p[2]; } else { u = nAxis === 0 ? p[2] : p[0]; v = p[1]; }
          tgt.v.push(p[0], p[1], p[2], n[0], n[1], n[2], cr, cg, cb, u, v, isT ? 1 : aoV[ao], bd.pat + cutflag);
        }
        tgt.n += 4;
        const flip = n[0] > 0 || n[1] > 0 || n[2] < 0;
        if (aos[0] + aos[2] < aos[1] + aos[3]) {
          if (flip) tgt.i.push(base + 1, base, base + 3, base + 1, base + 3, base + 2);
          else tgt.i.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        } else {
          if (flip) tgt.i.push(base, base + 3, base + 2, base, base + 2, base + 1);
          else tgt.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
    if (Hn) {
      LowPoly.terrain(world, X0, Z0, X1, Z1, out.o);
      if (world.trees) for (const t of world.trees) { if (t.down) continue; const tx = Math.floor(t.x), tz = Math.floor(t.z); if (tx >= X0 && tx < X1 && tz >= Z0 && tz < Z1) LowPoly.tree(world, t, out.o); }
    }
    const ch = { cx, cz, x: X0 + this.CS / 2, z: Z0 + this.CS / 2,
      o: out.o.n ? this.makeVAO(new Float32Array(out.o.v), new Uint32Array(out.o.i)) : null,
      t: out.t.n ? this.makeVAO(new Float32Array(out.t.v), new Uint32Array(out.t.i)) : null };
    this.chunks.set(key, ch);
    return out.o.n + out.t.n;
  },
  visChunks(r) {
    const out = [], c = this.cam, e = this.eye || [c.tx, c.ty, c.tz];
    if (!this.chunks) return out;
    const fx = c.tx - e[0], fz = c.tz - e[2], fl = Math.hypot(fx, fz) || 1;
    for (const ch of this.chunks.values()) {
      const dx = ch.x - c.tx, dz = ch.z - c.tz, d = Math.hypot(dx, dz);
      if (d > r + 12) continue;
      // drop chunks well behind the camera
      const ex = ch.x - e[0], ez = ch.z - e[2], ed = Math.hypot(ex, ez);
      if (ed > 24 && (ex * fx + ez * fz) / (ed * fl) < -0.35) continue;
      out.push(ch);
    }
    return out;
  },

  setEnv(e) {
    this.env = Object.assign({
      sun: V3.norm([0.45, 0.8, 0.3]), sunCol: [1.0, 0.95, 0.85], sky: [0.55, 0.65, 0.8], ground: [0.35, 0.3, 0.25],
      amb: 0.75, fog: [0.7, 0.78, 0.88], fogN: 40, fogF: 110, skyTop: [0.35, 0.55, 0.85], skyBot: [0.8, 0.85, 0.92], night: 0
    }, e || {});
    this.env.sun = V3.norm(this.env.sun);
  },

  // queue a box: model matrix, color [r,g,b], opts
  box(m, col, emit, alpha) { this.queue.push({ m, col, emit: emit || null, a: alpha === undefined ? 1 : alpha }); },
  // inverted-hull outline: an enlarged box drawn back-faces-only in a flat glow colour
  xray(m, col, a) { this.queue.push({ m, col: [0, 0, 0], emit: [col[0], col[1], col[2], 1], a: 1, xr: a || 0.4, noShadow: true }); },
  outline(m, col, k) { this.queue.push({ m, col: [0, 0, 0], emit: [col[0], col[1], col[2], k === undefined ? 1 : k], a: 1, outline: true, noShadow: true }); },

  updateCamera() {
    const c = this.cam, cv = this.canvas;
    const asp = cv.width / cv.height;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const sh = this.shakeAmt, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh, oz = (Math.random() - 0.5) * sh;
    this.eye = [c.tx + ox + Math.sin(c.yaw) * cp * c.dist, c.ty + oy + sp * c.dist, c.tz + oz + Math.cos(c.yaw) * cp * c.dist];
    this.view = M4.lookAt(this.eye, [c.tx + ox, c.ty + oy, c.tz + oz], [0, 1, 0]);
    this.proj = M4.persp(c.fov, asp, 0.3, 260);
    this.vp = M4.mul(this.proj, this.view);
    // light
    const s = this.env.sun, R = 34;
    const ctr = [c.tx, c.ty, c.tz];
    const le = V3.add(ctr, V3.scale(s, 80));
    const lv = M4.lookAt(le, ctr, Math.abs(s[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
    this.lvp = M4.mul(M4.ortho(-R, R, -R, R, 1, 200), lv);
  },

  render(dt) {
    const gl = this.gl, cv = this.canvas;
    this.time += dt;
    this.shakeAmt *= Math.exp(-dt * 7); if (this.shakeAmt < 0.005) this.shakeAmt = 0;
    this.updateCamera();
    const E = this.env, shadows = this.quality === 'high';
    // shadow pass
    this.flushDirty(2);
    const VIS = this.visChunks(this.viewDist || 80);
    if (shadows && this.chunks) {
      const P = this.progs.depth;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
      gl.useProgram(P.p); gl.uniformMatrix4fv(P.u.uLVP, false, this.lvp);
      gl.uniformMatrix4fv(P.u.uModel, false, M4.ident());
      for (const ch of VIS) { if (!ch.o || Math.hypot(ch.x - this.cam.tx, ch.z - this.cam.tz) > 46) continue; gl.bindVertexArray(ch.o.vao); gl.drawElements(gl.TRIANGLES, ch.o.count, gl.UNSIGNED_INT, 0); }
      gl.bindVertexArray(this.cube.vao);
      for (const q of this.queue) { if (q.a < 1 || q.noShadow || q.xr) continue; gl.uniformMatrix4fv(P.u.uModel, false, q.m); gl.drawElements(gl.TRIANGLES, this.cube.count, gl.UNSIGNED_SHORT, 0); }
      gl.cullFace(gl.BACK); gl.disable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(E.fog[0], E.fog[1], E.fog[2], this.noSky ? 0 : 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // sky
    gl.disable(gl.DEPTH_TEST);
    if (!this.noSky) {
    const S = this.progs.sky; gl.useProgram(S.p);
    gl.uniform3fv(S.u.uTop, E.skyTop); gl.uniform3fv(S.u.uBot, E.skyBot); gl.uniform1f(S.u.uTime, this.time); gl.uniform1i(S.u.uNight, E.night ? 1 : 0);
    gl.bindVertexArray(this.skyVAO); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.enable(gl.DEPTH_TEST);
    const P = this.progs.main; gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uVP, false, this.vp); gl.uniformMatrix4fv(P.u.uLVP, false, this.lvp);
    gl.uniform3fv(P.u.uSun, E.sun); gl.uniform3fv(P.u.uSunCol, E.sunCol); gl.uniform3fv(P.u.uSky, E.sky); gl.uniform3fv(P.u.uGround, E.ground);
    gl.uniform3fv(P.u.uFogCol, E.fog); gl.uniform1f(P.u.uFogN, E.fogN); gl.uniform1f(P.u.uFogF, E.fogF); gl.uniform1f(P.u.uAmb, E.amb); gl.uniform1f(P.u.uExpo, (this.exposure || 1.2) * (this.expoMul || 1));
    gl.uniform2f(P.u.uRes, cv.width, cv.height);
    if (this.fadeTarget) {
      const f = this.fadeTarget, fl = this.fadeLift === undefined ? 1.0 : this.fadeLift, pv = M4.xform(this.vp, [f[0], f[1] + fl, f[2], 1]);
      const sx = pv[0] / pv[3] * 0.5 + 0.5, sy = pv[1] / pv[3] * 0.5 + 0.5;
      const dist = Math.hypot(f[0] - this.eye[0], f[1] + fl - this.eye[1], f[2] - this.eye[2]);
      gl.uniform4f(P.u.uFade, sx, sy, dist, this.fadeR || 0.11); gl.uniform1f(P.u.uFadeY, f[1] + 0.35);
    } else gl.uniform4f(P.u.uFade, 0, 0, 0, 0);
    gl.uniform3fv(P.u.uCam, this.eye); gl.uniform1f(P.u.uCut, this.cut); gl.uniform1f(P.u.uTime, this.time);
    gl.uniform1i(P.u.uShadowOn, shadows ? 1 : 0); gl.uniform1f(P.u.uShTex, 1 / this.shadowSize);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(P.u.uShadow, 0);
    // lights
    const lp = new Float32Array(40), lc = new Float32Array(40);
    for (let i = 0; i < Math.min(10, this.lights.length); i++) { const L = this.lights[i]; lp.set([L.x, L.y, L.z, L.r], i * 4); lc.set([L.c[0], L.c[1], L.c[2], 1], i * 4); }
    gl.uniform4fv(P.u.uLP, lp); gl.uniform4fv(P.u.uLC, lc);
    gl.uniform4f(P.u.uTint, 1, 1, 1, 1); gl.uniform4f(P.u.uEmit, 0, 0, 0, 0); gl.uniform1i(P.u.uTrans, 0);
    gl.uniformMatrix4fv(P.u.uModel, false, M4.ident());
    gl.disable(gl.CULL_FACE);
    for (const ch of VIS) if (ch.o) { gl.bindVertexArray(ch.o.vao); gl.drawElements(gl.TRIANGLES, ch.o.count, gl.UNSIGNED_INT, 0); }
    // entities
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.bindVertexArray(this.cube.vao);
    const trans = [];
    const outl = [], xrays = [];
    for (const q of this.queue) {
      if (q.a < 1) { trans.push(q); continue; }
      if (q.outline) { outl.push(q); continue; }
      if (q.xr) { xrays.push(q); continue; }
      gl.uniformMatrix4fv(P.u.uModel, false, q.m);
      gl.uniform4f(P.u.uTint, q.col[0], q.col[1], q.col[2], 1);
      if (q.emit) gl.uniform4f(P.u.uEmit, q.emit[0], q.emit[1], q.emit[2], q.emit[3]); else gl.uniform4f(P.u.uEmit, 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, this.cube.count, gl.UNSIGNED_SHORT, 0);
    }
    if (outl.length) {
      gl.cullFace(gl.FRONT);
      for (const q of outl) { gl.uniformMatrix4fv(P.u.uModel, false, q.m); gl.uniform4f(P.u.uTint, 0, 0, 0, 1); gl.uniform4f(P.u.uEmit, q.emit[0], q.emit[1], q.emit[2], q.emit[3]); gl.drawElements(gl.TRIANGLES, this.cube.count, gl.UNSIGNED_SHORT, 0); }
      gl.cullFace(gl.BACK);
    }
    // transparent world
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1i(P.u.uTrans, 1);
    for (const q of trans) {
      gl.uniformMatrix4fv(P.u.uModel, false, q.m);
      gl.uniform4f(P.u.uTint, q.col[0], q.col[1], q.col[2], q.a);
      if (q.emit) gl.uniform4f(P.u.uEmit, q.emit[0], q.emit[1], q.emit[2], q.emit[3]); else gl.uniform4f(P.u.uEmit, 0, 0, 0, 0);
      gl.drawElements(gl.TRIANGLES, this.cube.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(P.u.uModel, false, M4.ident()); gl.uniform4f(P.u.uTint, 1, 1, 1, 1); gl.uniform4f(P.u.uEmit, 0, 0, 0, 0);
    for (const ch of VIS) if (ch.t) { gl.bindVertexArray(ch.t.vao); gl.drawElements(gl.TRIANGLES, ch.t.count, gl.UNSIGNED_INT, 0); }
    if (xrays.length) {
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.bindVertexArray(this.cube.vao);
      for (const q of xrays) { gl.uniformMatrix4fv(P.u.uModel, false, q.m); gl.uniform4f(P.u.uTint, 0, 0, 0, q.xr); gl.uniform4f(P.u.uEmit, q.emit[0], q.emit[1], q.emit[2], 1); gl.drawElements(gl.TRIANGLES, this.cube.count, gl.UNSIGNED_SHORT, 0); }
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    this.queue.length = 0;
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'lite' ? 1 : 1.25);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  },

  // screen (css px) -> world ray
  ray(sx, sy) {
    const cv = this.canvas, r = cv.getBoundingClientRect();
    const nx = ((sx - r.left) / r.width) * 2 - 1, ny = -(((sy - r.top) / r.height) * 2 - 1);
    const inv = M4.invert(this.vp);
    const a = M4.xform(inv, [nx, ny, -1, 1]), b = M4.xform(inv, [nx, ny, 1, 1]);
    const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], p1 = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    return { o: p0, d: V3.norm(V3.sub(p1, p0)) };
  },
  project(p) {
    const v = M4.xform(this.vp, [p[0], p[1], p[2], 1]);
    if (v[3] <= 0) return null;
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v[0] / v[3] * 0.5 + 0.5) * r.width, y: r.top + (1 - (v[1] / v[3] * 0.5 + 0.5)) * r.height };
  }
};

// ray vs AABB -> t or -1
function rayAABB(o, d, mn, mx) {
  let t0 = 0, t1 = 1e9;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / (d[i] || 1e-9);
    let ta = (mn[i] - o[i]) * inv, tb = (mx[i] - o[i]) * inv;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t1 < t0) return -1;
  }
  return t0;
}
