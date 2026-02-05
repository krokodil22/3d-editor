(() => {
  // --------- UI helpers ----------
  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const errorBox = $("errorBox");
  const errorText = $("errorText");
  function setStatus(t){ statusEl.textContent = t; }
  function showError(e){
    errorBox.classList.remove("hidden");
    errorText.textContent = (e && e.stack) ? e.stack : String(e);
    console.error(e);
  }
  window.addEventListener("error", (e)=>showError(e.error||e.message));
  window.addEventListener("unhandledrejection", (e)=>showError(e.reason));

  // --------- Minimal math (vec3, mat4) ----------
  const V3 = {
    add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
    sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
    muls:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
    dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
    cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
    len:(a)=>Math.hypot(a[0],a[1],a[2]),
    norm:(a)=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; },
    min:(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.min(a[2],b[2])],
    max:(a,b)=>[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.max(a[2],b[2])]
  };

  const M4 = {
    ident:()=>[1,0,0,0,  0,1,0,0,  0,0,1,0,  0,0,0,1],
    mul:(a,b)=>{ // a*b
      const o=new Array(16);
      for(let r=0;r<4;r++){
        for(let c=0;c<4;c++){
          o[c+r*4]=a[r*4+0]*b[c+0]+a[r*4+1]*b[c+4]+a[r*4+2]*b[c+8]+a[r*4+3]*b[c+12];
        }
      }
      return o;
    },
    translate:(m,v)=>{
      const t=M4.ident();
      t[12]=v[0]; t[13]=v[1]; t[14]=v[2];
      return M4.mul(m,t);
    },
    scale:(m,v)=>{
      const s=M4.ident();
      s[0]=v[0]; s[5]=v[1]; s[10]=v[2];
      return M4.mul(m,s);
    },
    rotY:(m,a)=>{
      const c=Math.cos(a), s=Math.sin(a);
      const r=[c,0,-s,0,  0,1,0,0,  s,0,c,0,  0,0,0,1];
      return M4.mul(m,r);
    },
    rotX:(m,a)=>{
      const c=Math.cos(a), s=Math.sin(a);
      const r=[1,0,0,0,  0,c,s,0,  0,-s,c,0,  0,0,0,1];
      return M4.mul(m,r);
    },
    perspective:(fovy, aspect, near, far)=>{
      const f=1/Math.tan(fovy/2);
      const nf=1/(near-far);
      return [
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,(2*far*near)*nf,0
      ];
    },
    lookAt:(eye, target, up)=>{
      const z = V3.norm(V3.sub(eye,target));   // forward
      const x = V3.norm(V3.cross(up,z));       // right
      const y = V3.cross(z,x);                 // up'
      return [
        x[0],y[0],z[0],0,
        x[1],y[1],z[1],0,
        x[2],y[2],z[2],0,
        -V3.dot(x,eye), -V3.dot(y,eye), -V3.dot(z,eye), 1
      ];
    },
    invert:(m)=>{
      // generic 4x4 inverse (compact, adapted)
      const a=m;
      const inv=new Array(16);
      inv[0]=a[5]*a[10]*a[15]-a[5]*a[11]*a[14]-a[9]*a[6]*a[15]+a[9]*a[7]*a[14]+a[13]*a[6]*a[11]-a[13]*a[7]*a[10];
      inv[4]=-a[4]*a[10]*a[15]+a[4]*a[11]*a[14]+a[8]*a[6]*a[15]-a[8]*a[7]*a[14]-a[12]*a[6]*a[11]+a[12]*a[7]*a[10];
      inv[8]=a[4]*a[9]*a[15]-a[4]*a[11]*a[13]-a[8]*a[5]*a[15]+a[8]*a[7]*a[13]+a[12]*a[5]*a[11]-a[12]*a[7]*a[9];
      inv[12]=-a[4]*a[9]*a[14]+a[4]*a[10]*a[13]+a[8]*a[5]*a[14]-a[8]*a[6]*a[13]-a[12]*a[5]*a[10]+a[12]*a[6]*a[9];
      inv[1]=-a[1]*a[10]*a[15]+a[1]*a[11]*a[14]+a[9]*a[2]*a[15]-a[9]*a[3]*a[14]-a[13]*a[2]*a[11]+a[13]*a[3]*a[10];
      inv[5]=a[0]*a[10]*a[15]-a[0]*a[11]*a[14]-a[8]*a[2]*a[15]+a[8]*a[3]*a[14]+a[12]*a[2]*a[11]-a[12]*a[3]*a[10];
      inv[9]=-a[0]*a[9]*a[15]+a[0]*a[11]*a[13]+a[8]*a[1]*a[15]-a[8]*a[3]*a[13]-a[12]*a[1]*a[11]+a[12]*a[3]*a[9];
      inv[13]=a[0]*a[9]*a[14]-a[0]*a[10]*a[13]-a[8]*a[1]*a[14]+a[8]*a[2]*a[13]+a[12]*a[1]*a[10]-a[12]*a[2]*a[9];
      inv[2]=a[1]*a[6]*a[15]-a[1]*a[7]*a[14]-a[5]*a[2]*a[15]+a[5]*a[3]*a[14]+a[13]*a[2]*a[7]-a[13]*a[3]*a[6];
      inv[6]=-a[0]*a[6]*a[15]+a[0]*a[7]*a[14]+a[4]*a[2]*a[15]-a[4]*a[3]*a[14]-a[12]*a[2]*a[7]+a[12]*a[3]*a[6];
      inv[10]=a[0]*a[5]*a[15]-a[0]*a[7]*a[13]-a[4]*a[1]*a[15]+a[4]*a[3]*a[13]+a[12]*a[1]*a[7]-a[12]*a[3]*a[5];
      inv[14]=-a[0]*a[5]*a[14]+a[0]*a[6]*a[13]+a[4]*a[1]*a[14]-a[4]*a[2]*a[13]-a[12]*a[1]*a[6]+a[12]*a[2]*a[5];
      inv[3]=-a[1]*a[6]*a[11]+a[1]*a[7]*a[10]+a[5]*a[2]*a[11]-a[5]*a[3]*a[10]-a[9]*a[2]*a[7]+a[9]*a[3]*a[6];
      inv[7]=a[0]*a[6]*a[11]-a[0]*a[7]*a[10]-a[4]*a[2]*a[11]+a[4]*a[3]*a[10]+a[8]*a[2]*a[7]-a[8]*a[3]*a[6];
      inv[11]=-a[0]*a[5]*a[11]+a[0]*a[7]*a[9]+a[4]*a[1]*a[11]-a[4]*a[3]*a[9]-a[8]*a[1]*a[7]+a[8]*a[3]*a[5];
      inv[15]=a[0]*a[5]*a[10]-a[0]*a[6]*a[9]-a[4]*a[1]*a[10]+a[4]*a[2]*a[9]+a[8]*a[1]*a[6]-a[8]*a[2]*a[5];
      let det=a[0]*inv[0]+a[1]*inv[4]+a[2]*inv[8]+a[3]*inv[12];
      det = det || 1e-12;
      det = 1/det;
      for(let i=0;i<16;i++) inv[i]*=det;
      return inv;
    },
    transformPoint:(m,p)=>{
      const x=p[0],y=p[1],z=p[2];
      const w = m[3]*x + m[7]*y + m[11]*z + m[15];
      const nx = (m[0]*x + m[4]*y + m[8]*z + m[12]) / w;
      const ny = (m[1]*x + m[5]*y + m[9]*z + m[13]) / w;
      const nz = (m[2]*x + m[6]*y + m[10]*z + m[14]) / w;
      return [nx,ny,nz];
    }
  };

  // --------- WebGL setup ----------
  const canvas = document.getElementById("gl");
  const gl = canvas.getContext("webgl2", { antialias:true });
  if(!gl){ showError("WebGL2 недоступен в браузере."); return; }

  const vs = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNor;
  uniform mat4 uMVP;
  uniform mat4 uModel;
  out vec3 vNor;
  out vec3 vPos;
  void main(){
    vec4 wp = uModel * vec4(aPos,1.0);
    vPos = wp.xyz;
    vNor = mat3(uModel) * aNor;
    gl_Position = uMVP * vec4(aPos,1.0);
  }`;
  const fs = `#version 300 es
  precision highp float;
  in vec3 vNor;
  in vec3 vPos;
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  out vec4 outColor;
  void main(){
    vec3 N = normalize(vNor);
    float diff = max(dot(N, normalize(-uLightDir)), 0.0);
    float amb = 0.35;
    vec3 col = uColor * (amb + diff*0.85);
    outColor = vec4(col, 1.0);
  }`;
  function compile(type, src){
    const s=gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      throw new Error(gl.getShaderInfoLog(s) || "Shader compile error");
    }
    return s;
  }
  function link(vs,fs){
    const p=gl.createProgram();
    gl.attachShader(p,vs);
    gl.attachShader(p,fs);
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)){
      throw new Error(gl.getProgramInfoLog(p) || "Program link error");
    }
    return p;
  }

  let program;
  try{
    program = link(compile(gl.VERTEX_SHADER, vs), compile(gl.FRAGMENT_SHADER, fs));
  }catch(e){ showError(e); return; }

  const uMVP = gl.getUniformLocation(program, "uMVP");
  const uModel = gl.getUniformLocation(program, "uModel");
  const uColor = gl.getUniformLocation(program, "uColor");
  const uLightDir = gl.getUniformLocation(program, "uLightDir");

  gl.enable(gl.DEPTH_TEST);

  // --------- Grid lines (drawn as separate simple program) ----------
  const gridVS = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPos;
  uniform mat4 uMVP;
  void main(){ gl_Position = uMVP * vec4(aPos,1.0); }`;
  const gridFS = `#version 300 es
  precision highp float;
  uniform vec3 uColor;
  out vec4 outColor;
  void main(){ outColor = vec4(uColor,1.0); }`;

  let gridProg;
  try{
    gridProg = link(compile(gl.VERTEX_SHADER, gridVS), compile(gl.FRAGMENT_SHADER, gridFS));
  }catch(e){ showError(e); return; }
  const g_uMVP = gl.getUniformLocation(gridProg, "uMVP");
  const g_uColor = gl.getUniformLocation(gridProg, "uColor");

  function makeGrid(size=600, step=10){
    const half = size/2;
    const verts=[];
    for(let x=-half; x<=half; x+=step){
      verts.push(x,0,-half,  x,0,half);
    }
    for(let z=-half; z<=half; z+=step){
      verts.push(-half,0,z,  half,0,z);
    }
    return new Float32Array(verts);
  }

  const gridVBO = gl.createBuffer();
  const gridVerts = makeGrid(600,10);
  gl.bindBuffer(gl.ARRAY_BUFFER, gridVBO);
  gl.bufferData(gl.ARRAY_BUFFER, gridVerts, gl.STATIC_DRAW);

  // --------- Mesh generation ----------
  function makeMesh(positions, normals, indices){
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    // interleave pos+nor
    const vcount = positions.length/3;
    const inter = new Float32Array(vcount*6);
    for(let i=0;i<vcount;i++){
      inter[i*6+0]=positions[i*3+0];
      inter[i*6+1]=positions[i*3+1];
      inter[i*6+2]=positions[i*3+2];
      inter[i*6+3]=normals[i*3+0];
      inter[i*6+4]=normals[i*3+1];
      inter[i*6+5]=normals[i*3+2];
    }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    const idx = new Uint32Array(indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    // compute local AABB
    let mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<positions.length;i+=3){
      mn = V3.min(mn,[positions[i],positions[i+1],positions[i+2]]);
      mx = V3.max(mx,[positions[i],positions[i+1],positions[i+2]]);
    }

    return { vao, vbo, ebo, count: idx.length, aabb:{min:mn, max:mx}, positions, indices };
  }

  function cube(w,h,d){
    const x=w/2, y=h/2, z=d/2;
    // 24 vertices (4 per face) for correct normals
    const P=[
      // +X
      x,-y,-z,  x, y,-z,  x, y, z,  x,-y, z,
      // -X
      -x,-y, z, -x, y, z, -x, y,-z, -x,-y,-z,
      // +Y
      -x, y,-z, -x, y, z,  x, y, z,  x, y,-z,
      // -Y
      -x,-y, z, -x,-y,-z,  x,-y,-z,  x,-y, z,
      // +Z
      -x,-y, z,  x,-y, z,  x, y, z, -x, y, z,
      // -Z
      x,-y,-z, -x,-y,-z, -x, y,-z,  x, y,-z
    ];
    const N=[
      1,0,0, 1,0,0, 1,0,0, 1,0,0,
      -1,0,0,-1,0,0,-1,0,0,-1,0,0,
      0,1,0,0,1,0,0,1,0,0,1,0,
      0,-1,0,0,-1,0,0,-1,0,0,-1,0,
      0,0,1,0,0,1,0,0,1,0,0,1,
      0,0,-1,0,0,-1,0,0,-1,0,0,-1
    ];
    const I=[];
    for(let f=0;f<6;f++){
      const o=f*4;
      I.push(o,o+1,o+2, o,o+2,o+3);
    }
    return makeMesh(P,N,I);
  }

  function sphere(r, seg=24, ring=16){
    const P=[], N=[], I=[];
    for(let y=0;y<=ring;y++){
      const v=y/ring;
      const phi=v*Math.PI;
      for(let x=0;x<=seg;x++){
        const u=x/seg;
        const theta=u*Math.PI*2;
        const sx=Math.cos(theta)*Math.sin(phi);
        const sy=Math.cos(phi);
        const sz=Math.sin(theta)*Math.sin(phi);
        P.push(sx*r, sy*r, sz*r);
        N.push(sx,sy,sz);
      }
    }
    const row=seg+1;
    for(let y=0;y<ring;y++){
      for(let x=0;x<seg;x++){
        const a=y*row+x;
        const b=a+row;
        I.push(a,b,a+1, b,b+1,a+1);
      }
    }
    return makeMesh(P,N,I);
  }

  function cylinder(rt, rb, h, seg=28){
    const P=[], N=[], I=[];
    const half=h/2;
    // side
    for(let i=0;i<=seg;i++){
      const u=i/seg;
      const a=u*Math.PI*2;
      const ca=Math.cos(a), sa=Math.sin(a);
      const xt=ca*rt, zt=sa*rt;
      const xb=ca*rb, zb=sa*rb;
      P.push(xt, half, zt, xb,-half, zb);
      // approximate normal for frustum
      const nx=ca, nz=sa;
      N.push(nx,0,nz, nx,0,nz);
    }
    for(let i=0;i<seg;i++){
      const o=i*2;
      I.push(o,o+1,o+2, o+1,o+3,o+2);
    }
    // top cap
    const topCenter = P.length/3;
    P.push(0,half,0); N.push(0,1,0);
    for(let i=0;i<=seg;i++){
      const a=i/seg*Math.PI*2;
      const ca=Math.cos(a), sa=Math.sin(a);
      P.push(ca*rt, half, sa*rt);
      N.push(0,1,0);
    }
    for(let i=0;i<seg;i++){
      const a=topCenter;
      const b=topCenter+1+i;
      const c=topCenter+1+i+1;
      I.push(a,b,c);
    }
    // bottom cap
    const botCenter = P.length/3;
    P.push(0,-half,0); N.push(0,-1,0);
    for(let i=0;i<=seg;i++){
      const a=i/seg*Math.PI*2;
      const ca=Math.cos(a), sa=Math.sin(a);
      P.push(ca*rb, -half, sa*rb);
      N.push(0,-1,0);
    }
    for(let i=0;i<seg;i++){
      const a=botCenter;
      const b=botCenter+1+i+1;
      const c=botCenter+1+i;
      I.push(a,b,c);
    }
    return makeMesh(P,N,I);
  }

  function cone(r, h, seg=28){
    return cylinder(0, r, h, seg);
  }

  function torus(R, r, segR=32, segr=16){
    const P=[], N=[], I=[];
    for(let j=0;j<=segr;j++){
      const v=j/segr*Math.PI*2;
      const cv=Math.cos(v), sv=Math.sin(v);
      for(let i=0;i<=segR;i++){
        const u=i/segR*Math.PI*2;
        const cu=Math.cos(u), su=Math.sin(u);
        const x = (R + r*cv)*cu;
        const z = (R + r*cv)*su;
        const y = r*sv;
        P.push(x,y,z);
        // normal from center of tube
        const nx = cv*cu;
        const nz = cv*su;
        const ny = sv;
        N.push(nx,ny,nz);
      }
    }
    const row=segR+1;
    for(let j=0;j<segr;j++){
      for(let i=0;i<segR;i++){
        const a=j*row+i;
        const b=a+row;
        I.push(a,b,a+1, b,b+1,a+1);
      }
    }
    return makeMesh(P,N,I);
  }

  // --------- Scene objects ----------
  let objects=[];
  let selectedId=null;
  let idCounter=1;

  function hexToRgb01(hex){
    const h=hex.replace("#","");
    const n=parseInt(h,16);
    return [(n>>16&255)/255, (n>>8&255)/255, (n&255)/255];
  }
  function snap(v, step){
    return Math.round(v/step)*step;
  }

  function addObject(type){
    let mesh;
    if(type==="box") mesh=cube(40,20,40);
    if(type==="sphere") mesh=sphere(18, 28, 18);
    if(type==="cyl") mesh=cylinder(16,16,30, 32);
    if(type==="cone") mesh=cone(18,35, 32);
    if(type==="torus") mesh=torus(18,6, 40, 18);

    const obj={
      id:idCounter++,
      type,
      name: `${type}_${objects.length+1}`,
      mesh,
      pos:[0,10,0],
      rotY:0,
      scale:[1,1,1],
      color:"#ff5533"
    };
    objects.push(obj);
    select(obj.id);
    setStatus(`Добавлено: ${obj.name}`);
  }

  // --------- Camera orbit (custom) ----------
  const cam = {
    target:[0,0,0],
    yaw: Math.PI/4,
    pitch: 0.65,
    dist: 520
  };

  function cameraEye(){
    const cp=Math.cos(cam.pitch), sp=Math.sin(cam.pitch);
    const cy=Math.cos(cam.yaw), sy=Math.sin(cam.yaw);
    const x = cam.target[0] + cam.dist * cp * cy;
    const z = cam.target[2] + cam.dist * cp * sy;
    const y = cam.target[1] + cam.dist * sp;
    return [x,y,z];
  }

  // --------- Ray casting & plane intersection ----------
  function screenRay(nx, ny, view, proj){
    // build inverse VP
    const invVP = M4.invert(M4.mul(view, proj)); // NOTE: our mul is row-major-ish; but consistent within this file
    // We'll compute by unprojecting with inverse(proj*view) actually.
  }

  // We'll do unproject using inverse(P*V)
  function unproject(nx, ny, nz, invPV){
    return M4.transformPoint(invPV, [nx, ny, nz]);
  }

  function rayFromMouse(mx, my, view, proj){
    const rect = canvas.getBoundingClientRect();
    const nx = ((mx-rect.left)/rect.width)*2-1;
    const ny = -(((my-rect.top)/rect.height)*2-1);

    const PV = M4.mul(proj, view);
    const invPV = M4.invert(PV);

    const pNear = unproject(nx, ny, -1, invPV);
    const pFar  = unproject(nx, ny,  1, invPV);
    const dir = V3.norm(V3.sub(pFar, pNear));
    return { origin:pNear, dir };
  }

  function rayPlane(ray, planeN, planeD){
    // plane: dot(n, p) + d = 0
    const denom = V3.dot(planeN, ray.dir);
    if(Math.abs(denom) < 1e-6) return null;
    const t = -(V3.dot(planeN, ray.origin) + planeD) / denom;
    if(t < 0) return null;
    return V3.add(ray.origin, V3.muls(ray.dir, t));
  }

  function aabbWorld(obj){
    const a=obj.mesh.aabb;
    const min=a.min, max=a.max;
    // transform 8 corners (conservative)
    const m = modelMatrix(obj);
    const pts=[
      [min[0],min[1],min[2]],[max[0],min[1],min[2]],[min[0],max[1],min[2]],[max[0],max[1],min[2]],
      [min[0],min[1],max[2]],[max[0],min[1],max[2]],[min[0],max[1],max[2]],[max[0],max[1],max[2]],
    ];
    let mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
    for(const p of pts){
      const tp = transformPoint3(m, p);
      mn = V3.min(mn,tp);
      mx = V3.max(mx,tp);
    }
    return {min:mn, max:mx};
  }

  function transformPoint3(m, p){
    const x=p[0],y=p[1],z=p[2];
    return [
      m[0]*x + m[4]*y + m[8]*z + m[12],
      m[1]*x + m[5]*y + m[9]*z + m[13],
      m[2]*x + m[6]*y + m[10]*z + m[14],
    ];
  }

  function rayAABB(ray, aabb){
    const o=ray.origin, d=ray.dir;
    const t1=(aabb.min[0]-o[0])/(d[0]||1e-9);
    const t2=(aabb.max[0]-o[0])/(d[0]||1e-9);
    const t3=(aabb.min[1]-o[1])/(d[1]||1e-9);
    const t4=(aabb.max[1]-o[1])/(d[1]||1e-9);
    const t5=(aabb.min[2]-o[2])/(d[2]||1e-9);
    const t6=(aabb.max[2]-o[2])/(d[2]||1e-9);
    const tmin=Math.max(Math.min(t1,t2), Math.min(t3,t4), Math.min(t5,t6));
    const tmax=Math.min(Math.max(t1,t2), Math.max(t3,t4), Math.max(t5,t6));
    if(tmax<0 || tmin>tmax) return null;
    return tmin>=0 ? tmin : tmax;
  }

  // --------- Matrices for objects ----------
  function modelMatrix(obj){
    let m=M4.ident();
    m = M4.translate(m, obj.pos);
    m = M4.rotY(m, obj.rotY);
    m = M4.scale(m, obj.scale);
    return m;
  }

  // --------- Selection & props ----------
  const addButtons = document.querySelectorAll("[data-add]");
  addButtons.forEach(b=>b.addEventListener("click", ()=>addObject(b.dataset.add)));

  const toolSelect=$("toolSelect");
  const toolMove=$("toolMove");
  const toolRotate=$("toolRotate");
  const toolScale=$("toolScale");
  let tool="select";
  function setTool(t){
    tool=t;
    setStatus(`Инструмент: ${t}`);
  }
  toolSelect.addEventListener("click", ()=>setTool("select"));
  toolMove.addEventListener("click", ()=>setTool("move"));
  toolRotate.addEventListener("click", ()=>setTool("rotate"));
  toolScale.addEventListener("click", ()=>setTool("scale"));

  const snapToggle=$("snapToggle");
  const snapStep=$("snapStep");

  const noSelection=$("noSelection");
  const props=$("props");
  const objName=$("objName");
  const sizeX=$("sizeX");
  const sizeY=$("sizeY");
  const sizeZ=$("sizeZ");
  const color=$("color");
  const deleteBtn=$("deleteBtn");
  const duplicateBtn=$("duplicateBtn");
  const exportStlBtn=$("exportStlBtn");
  const clearBtn=$("clearBtn");
  const saveJsonBtn=$("saveJsonBtn");
  const loadJsonBtn=$("loadJsonBtn");
  const jsonFile=$("jsonFile");

  function selectedObj(){
    return objects.find(o=>o.id===selectedId) || null;
  }

  function objSize(obj){
    const a=obj.mesh.aabb;
    const sx=(a.max[0]-a.min[0])*obj.scale[0];
    const sy=(a.max[1]-a.min[1])*obj.scale[1];
    const sz=(a.max[2]-a.min[2])*obj.scale[2];
    return [Math.abs(sx),Math.abs(sy),Math.abs(sz)];
  }

  function setSize(obj, W,H,D){
    const a=obj.mesh.aabb;
    const base=[a.max[0]-a.min[0], a.max[1]-a.min[1], a.max[2]-a.min[2]];
    obj.scale=[
      (W||1)/ (base[0]||1),
      (H||1)/ (base[1]||1),
      (D||1)/ (base[2]||1)
    ];
  }

  function updateProps(){
    const o=selectedObj();
    const has=!!o;
    noSelection.classList.toggle("hidden", has);
    props.classList.toggle("hidden", !has);
    if(!has) return;
    objName.value=o.name;
    const s=objSize(o);
    sizeX.value=s[0].toFixed(1);
    sizeY.value=s[1].toFixed(1);
    sizeZ.value=s[2].toFixed(1);
    color.value=o.color;
  }

  function select(id){
    selectedId=id;
    updateProps();
  }

  objName.addEventListener("input", ()=>{
    const o=selectedObj(); if(!o) return;
    o.name=objName.value.trim();
  });
  color.addEventListener("input", ()=>{
    const o=selectedObj(); if(!o) return;
    o.color=color.value;
  });
  function applySizeInputs(){
    const o=selectedObj(); if(!o) return;
    const W=parseFloat(sizeX.value)||1;
    const H=parseFloat(sizeY.value)||1;
    const D=parseFloat(sizeZ.value)||1;
    setSize(o,W,H,D);
    updateProps();
  }
  [sizeX,sizeY,sizeZ].forEach(el=>{
    el.addEventListener("change", applySizeInputs);
    el.addEventListener("keydown", (e)=>{ if(e.key==="Enter") applySizeInputs(); });
  });

  deleteBtn.addEventListener("click", ()=>{
    const o=selectedObj(); if(!o) return;
    objects = objects.filter(x=>x.id!==o.id);
    selectedId=null;
    updateProps();
  });

  duplicateBtn.addEventListener("click", ()=>{
    const o=selectedObj(); if(!o) return;
    const copy={
      ...o,
      id:idCounter++,
      name:o.name+"_copy",
      pos:[o.pos[0]+20, o.pos[1], o.pos[2]+20],
      scale:[...o.scale]
    };
    objects.push(copy);
    select(copy.id);
  });

  clearBtn.addEventListener("click", ()=>{
    objects=[];
    selectedId=null;
    updateProps();
    setStatus("Сцена очищена");
  });

  // JSON save/load (custom)
  saveJsonBtn.addEventListener("click", ()=>{
    const data={ version:1, objects: objects.map(o=>({
      id:o.id, type:o.type, name:o.name, pos:o.pos, rotY:o.rotY, scale:o.scale, color:o.color
    }))};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}), "project.json");
  });

  loadJsonBtn.addEventListener("click", ()=>jsonFile.click());
  jsonFile.addEventListener("change", async ()=>{
    const f=jsonFile.files && jsonFile.files[0];
    if(!f) return;
    const txt=await f.text();
    let data; try{ data=JSON.parse(txt);}catch{ setStatus("Ошибка: не JSON"); return; }
    if(!data || !Array.isArray(data.objects)){ setStatus("Неверный формат"); return; }
    objects=[];
    selectedId=null;
    idCounter=1;
    for(const it of data.objects){
      // rebuild mesh for each type
      let mesh;
      if(it.type==="box") mesh=cube(40,20,40);
      if(it.type==="sphere") mesh=sphere(18, 28, 18);
      if(it.type==="cyl") mesh=cylinder(16,16,30, 32);
      if(it.type==="cone") mesh=cone(18,35, 32);
      if(it.type==="torus") mesh=torus(18,6, 40, 18);
      const obj={
        id: it.id || idCounter++,
        type: it.type,
        name: it.name || it.type,
        mesh,
        pos: it.pos || [0,10,0],
        rotY: it.rotY || 0,
        scale: it.scale || [1,1,1],
        color: it.color || "#ff5533"
      };
      objects.push(obj);
      idCounter = Math.max(idCounter, obj.id+1);
    }
    setStatus("Проект загружен");
    jsonFile.value="";
    updateProps();
  });

  // STL export (ASCII)
  exportStlBtn.addEventListener("click", ()=>{
    const stl = exportSTL(objects);
    downloadBlob(new Blob([stl],{type:"text/plain"}), "model.stl");
    setStatus("Экспортировано: model.stl");
  });

  function exportSTL(objs){
    let out="solid model\n";
    for(const o of objs){
      const m = modelMatrix(o);
      const P = o.mesh.positions;
      const I = o.mesh.indices;
      for(let i=0;i<I.length;i+=3){
        const ia=I[i]*3, ib=I[i+1]*3, ic=I[i+2]*3;
        const a=transformPoint3(m, [P[ia],P[ia+1],P[ia+2]]);
        const b=transformPoint3(m, [P[ib],P[ib+1],P[ib+2]]);
        const c=transformPoint3(m, [P[ic],P[ic+1],P[ic+2]]);
        const n = V3.norm(V3.cross(V3.sub(b,a), V3.sub(c,a)));
        out += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n`;
        out += `    outer loop\n`;
        out += `      vertex ${a[0]} ${a[1]} ${a[2]}\n`;
        out += `      vertex ${b[0]} ${b[1]} ${b[2]}\n`;
        out += `      vertex ${c[0]} ${c[1]} ${c[2]}\n`;
        out += `    endloop\n`;
        out += `  endfacet\n`;
      }
    }
    out += "endsolid model\n";
    return out;
  }

  function downloadBlob(blob, filename){
    const a=document.createElement("a");
    const url=URL.createObjectURL(blob);
    a.href=url; a.download=filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // --------- Mouse controls (camera + selection + transform) ----------
  let isOrbit=false;
  let isTransform=false;
  let last=[0,0];
  let dragStart=null;
  let startPos=null;
  let startRotY=0;
  let startScale=null;

  function getVP(){
    const w=canvas.width, h=canvas.height;
    const proj=M4.perspective(55*Math.PI/180, w/h, 0.1, 5000);
    const eye=cameraEye();
    const view=M4.lookAt(eye, cam.target, [0,1,0]);
    return {proj, view, eye};
  }

  function pick(mx,my){
    const {proj, view} = getVP();
    const ray = rayFromMouse(mx,my, view, proj);
    let best=null, bestT=Infinity;
    for(const o of objects){
      const aabb = aabbWorld(o);
      const t = rayAABB(ray, aabb);
      if(t!==null && t<bestT){
        bestT=t;
        best=o;
      }
    }
    return best ? best.id : null;
  }

  function beginTransform(mx,my){
    const o=selectedObj(); if(!o) return false;
    const {proj, view} = getVP();
    const ray = rayFromMouse(mx,my, view, proj);

    if(tool==="move"){
      // plane y=0
      const p = rayPlane(ray, [0,1,0], 0);
      if(!p) return false;
      dragStart=p;
      startPos=[...o.pos];
      return true;
    }
    if(tool==="rotate"){
      dragStart=[mx,my];
      startRotY=o.rotY;
      return true;
    }
    if(tool==="scale"){
      dragStart=[mx,my];
      startScale=[...o.scale];
      return true;
    }
    return false;
  }

  canvas.addEventListener("contextmenu", (e)=>e.preventDefault());

  canvas.addEventListener("pointerdown", (e)=>{
    last=[e.clientX,e.clientY];
    const right = (e.button===2);
    const shift = e.shiftKey;

    if(right || shift){
      isOrbit=true;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // left click
    if(tool==="select"){
      select(pick(e.clientX,e.clientY));
      return;
    }

    // if click on object -> select then transform
    const pid = pick(e.clientX,e.clientY);
    if(pid!==null){
      if(pid!==selectedId) select(pid);
      isTransform = beginTransform(e.clientX,e.clientY);
      if(isTransform) canvas.setPointerCapture(e.pointerId);
    }else{
      // click empty: deselect
      select(null);
    }
  });

  canvas.addEventListener("pointermove", (e)=>{
    const dx=e.clientX-last[0], dy=e.clientY-last[1];
    last=[e.clientX,e.clientY];

    if(isOrbit){
      cam.yaw += dx*0.008;
      cam.pitch += -dy*0.008;
      cam.pitch = Math.max(-0.1, Math.min(1.45, cam.pitch));
      return;
    }

    if(isTransform){
      const o=selectedObj(); if(!o) return;

      const doSnap = snapToggle.checked;
      const step = Math.max(parseFloat(snapStep.value||"1"), 0.0001);

      if(tool==="move"){
        const {proj, view} = getVP();
        const ray = rayFromMouse(e.clientX,e.clientY, view, proj);
        const p = rayPlane(ray, [0,1,0], 0);
        if(!p) return;
        const delta = V3.sub(p, dragStart);
        let nx = startPos[0] + delta[0];
        let nz = startPos[2] + delta[2];
        if(doSnap){ nx = snap(nx, step); nz = snap(nz, step); }
        o.pos[0]=nx; o.pos[2]=nz;
      }

      if(tool==="rotate"){
        const dd = dx;
        o.rotY = startRotY + dd*0.01;
      }

      if(tool==="scale"){
        const factor = Math.exp(-dy*0.01);
        o.scale = [startScale[0]*factor, startScale[1]*factor, startScale[2]*factor];
      }
      updateProps();
    }
  });

  canvas.addEventListener("pointerup", (e)=>{
    isOrbit=false;
    isTransform=false;
    dragStart=null;
    startPos=null;
    startScale=null;
  });

  canvas.addEventListener("wheel", (e)=>{
    cam.dist *= Math.exp(e.deltaY*0.0012);
    cam.dist = Math.max(80, Math.min(2500, cam.dist));
  }, {passive:true});

  // --------- Render loop ----------
  function resize(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio||1, 2);
    const w = Math.max(1, Math.floor(rect.width*dpr));
    const h = Math.max(1, Math.floor(rect.height*dpr));
    if(canvas.width!==w || canvas.height!==h){
      canvas.width=w; canvas.height=h;
      gl.viewport(0,0,w,h);
    }
  }
  window.addEventListener("resize", resize);

  function draw(){
    resize();
    gl.clearColor(0.06,0.07,0.08,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const {proj, view} = getVP();
    const VP = M4.mul(proj, view);

    // grid
    gl.useProgram(gridProg);
    gl.uniformMatrix4fv(g_uMVP, false, new Float32Array(VP));
    gl.uniform3fv(g_uColor, new Float32Array([0.14,0.16,0.20]));
    gl.bindBuffer(gl.ARRAY_BUFFER, gridVBO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
    gl.drawArrays(gl.LINES, 0, gridVerts.length/3);

    // objects
    gl.useProgram(program);
    gl.uniform3fv(uLightDir, new Float32Array([0.4,1.0,0.3]));
    for(const o of objects){
      const M = modelMatrix(o);
      const MVP = M4.mul(VP, M);

      const col = hexToRgb01(o.color);
      // highlight selection by brightening
      const isSel = (o.id===selectedId);
      const c = isSel ? [Math.min(1,col[0]*1.25+0.05), Math.min(1,col[1]*1.25+0.05), Math.min(1,col[2]*1.25+0.05)] : col;

      gl.uniformMatrix4fv(uMVP, false, new Float32Array(MVP));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(M));
      gl.uniform3fv(uColor, new Float32Array(c));

      gl.bindVertexArray(o.mesh.vao);
      gl.drawElements(gl.TRIANGLES, o.mesh.count, gl.UNSIGNED_INT, 0);
    }
    requestAnimationFrame(draw);
  }

  // Initial
  setStatus("Готово (OFFLINE)");
  updateProps();
  requestAnimationFrame(draw);
})();