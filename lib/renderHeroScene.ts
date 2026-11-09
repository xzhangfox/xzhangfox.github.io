import * as THREE from 'three'
import { approach, clamp, mix, smooth, type SceneEnvironment, type RGB } from './sceneEnvironment'
import { createApertureField, createWetHistory, dropStats, glassDrop, stepGlassWater, type GlassDrop } from './glassPhysics'

export interface SceneController {
  update(environment: SceneEnvironment, reduced: boolean): void
  setVisible(visible: boolean): void
  destroy(): void
}
const MAX_DROPS = 96
const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}'
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise2(p)*.57+noise2(p*2.03+17.)*.28+noise2(p*4.11+31.)*.15;}`
const skyFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D clouds;
uniform vec3 topColor,bottomColor,cloudColor;
uniform float time,aspect,night,rain,sunset;
${noise}
vec4 cloud(vec2 p){p.x=1.-abs(mod(p.x,2.)-1.);return texture2D(clouds,clamp(p,vec2(.001),vec2(.999)));}
void main(){
  vec2 p=vUv;
  vec3 sky=mix(bottomColor,topColor,pow(p.y,.65));
  float haze=pow(1.-p.y,3.);
  sky+=vec3(.04,.025,.015)*haze*(1.-night);
  // Two photographic layers have different distances and wind speeds. The camera stays fixed.
  vec4 c=cloud(vec2(p.x*aspect/1.7+time*.009+.14,p.y*.75+.23+sin(time*.012)*.014));
  vec4 farCloud=cloud(vec2(p.x*aspect/2.9-time*.003+.85,p.y*.68+.24));
  float density=c.a*(1.-night*.45);
  float detail=dot(c.rgb,vec3(.299,.587,.114));
  vec3 shade=mix(cloudColor*vec3(.62,.68,.77),cloudColor,smoothstep(.32,.98,detail));
  shade=mix(shade,vec3(.27,.32,.40),rain*.78);
  sky=mix(sky,shade,density*mix(.98,.68,night));
  sky=mix(sky,cloudColor*.92,farCloud.a*.10*(1.-density));
  // Sparse points and a soft, slowly rotating galactic haze live behind the cloud layer.
  float a=time*.00012;vec2 q=(p-.5)*vec2(aspect,1.);
  q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;
  vec2 grid=q*125.,cell=floor(grid),f=fract(grid)-.5;
  float seed=hash(cell),star=1.-smoothstep(.018,.14,length(f));
  star*=step(.962,seed)*(.65+.35*sin(seed*155.+time*.4)*sin(seed*155.+time*.4));
  float band=exp(-pow((q.y-q.x*.44-.10)*4.,2.))*fbm(q*5.+3.);
  sky+=(vec3(.78,.86,1.)*star*1.3+vec3(.19,.22,.35)*band*.48)*night*(1.-density*.6)*(1.-rain);
  float moon=exp(-length((p-vec2(.77,.76))*vec2(aspect,1.))*18.);
  sky+=vec3(.12,.16,.23)*moon*night*(1.-density)*(1.-rain);
  sky=mix(sky,vec3(.27,.33,.40)*mix(1.,.25,night),rain*.55);
  gl_FragColor=vec4(sky,1.);
}`
const blurFragment = `
varying vec2 vUv;
uniform sampler2D source;
uniform vec2 stepSize;
void main(){
 vec3 c=texture2D(source,vUv).rgb*.227027;
 c+=(texture2D(source,vUv+stepSize*1.384615).rgb+texture2D(source,vUv-stepSize*1.384615).rgb)*.316216;
 c+=(texture2D(source,vUv+stepSize*3.230769).rgb+texture2D(source,vUv-stepSize*3.230769).rgb)*.070270;
 gl_FragColor=vec4(c,1.);
}`
const dropVertex = `
attribute vec4 droplet;
attribute float dropMode;
uniform vec2 resolution;
varying vec2 local,screen;
varying float mode;
void main(){
 local=position.xy;mode=dropMode;
 vec2 extent=vec2(droplet.z,droplet.z*droplet.w);
 vec2 p=droplet.xy+position.xy*extent;
 screen=p/resolution;
 gl_Position=vec4(p/resolution*2.-1.,0.,1.);
}`
const dropFragment = `
precision highp float;
varying vec2 local,screen;
varying float mode;
uniform sampler2D letters;
uniform float scrollOffset;
void main(){
 // Surface tension keeps the bottom round, with a narrower shoulder as the bead slides.
 vec2 p=vec2(local.x/(.91-.12*local.y),local.y);
 float r2=dot(p,p);if(r2>1.)discard;
 float z=sqrt(max(.001,1.-r2));
 vec3 normal=normalize(vec3(p*.88,z));
 float coverage=1.-smoothstep(.87,1.,r2);
 float opening=texture2D(letters,vec2(screen.x,screen.y-scrollOffset)).a;
 if(mode<.5)coverage*=1.-opening;
 if(mode>1.5&&mode<2.5)coverage*=opening;
 gl_FragColor=vec4(normal.xy*.5+.5,z,coverage);
}`
const glassFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D clearSky,softSky,letters,windowField,water,traces;
uniform vec2 resolution;
uniform vec3 milk;
uniform float fog,night,scrollOffset,insetDepth;
${noise}
float aperture(vec2 p){p.y-=scrollOffset;return texture2D(letters,clamp(p,vec2(0.),vec2(1.))).a;}
vec4 windowSurface(vec2 p){p.y-=scrollOffset;return texture2D(windowField,clamp(vec2(p.x,1.-p.y),vec2(0.),vec2(1.)));}
vec3 pane(vec2 p){
 float window=aperture(p),trail=texture2D(traces,vec2(p.x,p.y-scrollOffset)).r;
 vec2 rough=vec2(hash(floor(p*resolution)),hash(floor(p*resolution)+13.))-.5;
 vec3 blur=texture2D(softSky,p+rough/resolution*1.5).rgb;
 float breath=fbm(p*vec2(3.,2.)+7.);
 float opacity=.77+fog*(.06+breath*.07)-trail*(.035+fog*.13);
 vec3 frost=mix(blur,milk,opacity);
 frost+=(hash(p*resolution)-.5)*.012*(1.-night*.45);
 vec3 view=texture2D(clearSky,p).rgb;
 vec4 boundary=windowSurface(p);float distance=(boundary.r-.5)*64.;
 vec2 normal=normalize(boundary.gb*2.-1.+vec2(.00001));
 // Only the inside of the opening has thickness. There is no raised outer bevel.
 float upper=clamp(dot(normal,vec2(.44,.90)),0.,1.);
 float bottom=clamp(-normal.y,0.,1.);
 float thickness=insetDepth*(.45+upper*.65);
 float wall=1.-smoothstep(thickness-.45,thickness+.65,distance);
 vec3 recess=frost*(.89-upper*.24+bottom*.09);
 recess=mix(recess,view,.10);
 float occlusion=exp(-max(0.,distance-thickness)/(insetDepth*.85))*upper*.18;
 vec3 opening=mix(view*(1.-occlusion),recess,wall);
 return mix(frost,opening,window);
}
void main(){
 vec2 p=vUv;vec4 drop=texture2D(water,p);
 vec3 color=pane(p);
 if(drop.a>.001){
   vec2 n=drop.rg*2.-1.;float z=drop.b;
   // Thick water bends the underlying aperture and magnifies a little of the distant sky.
   vec3 normal=normalize(vec3(n,z));
   vec3 transmitted=refract(vec3(0.,0.,-1.),normal,1./1.333);
   vec2 bent=clamp(p+transmitted.xy*(.006+z*.018),vec2(.001),vec2(.999));
   vec3 lens=pane(bent);
   lens=mix(lens,texture2D(clearSky,bent).rgb,.17*(1.-aperture(bent)));
   float fresnel=.02037+.97963*pow(1.-z,5.);
   vec3 reflectionSky=texture2D(clearSky,clamp(p+n*.12+vec2(0.,.08),vec2(.001),vec2(.999))).rgb;
   lens=mix(lens,reflectionSky,fresnel*.72);
   float glint=pow(max(0.,dot(normal,normalize(vec3(-.45,.62,.64)))),34.);
   float reflection=pow(max(0.,dot(normal,normalize(vec3(-.55,.73,.4)))),8.);
   lens+=vec3(.91,.96,1.)*(glint*.57+reflection*.06)*mix(1.,.50,night);
   lens+=vec3(.65,.79,.92)*pow(max(0.,-normal.y),6.)*.15*z;
   color=mix(color,lens,drop.a*.95);
 }
 // Condensation consists of very small beads, rather than a uniform fog overlay.
 vec2 g=p*resolution/8.,cell=floor(g),f=fract(g)-.5;
 float seed=hash(cell),micro=(1.-smoothstep(.02,.13,length(f-vec2(seed-.5,hash(cell+8.)-.5)*.5)));
 float condensation=fog*step(.71,seed)*(1.-texture2D(traces,vec2(p.x,p.y-scrollOffset)).r*.9)*(1.-aperture(p));
 color+=micro*condensation*.055;
 gl_FragColor=vec4(color,1.);
}`

// Continuous palettes across midnight; colors describe the sky, rather than tinting an old landscape.
const SKY: { h: number; top: RGB; bottom: RGB; cloud: RGB; milk: RGB }[] = [
  {h:0,top:[.025,.045,.11],bottom:[.13,.20,.34],cloud:[.42,.51,.68],milk:[.105,.145,.22]},
  {h:4,top:[.09,.08,.20],bottom:[.37,.31,.47],cloud:[.48,.44,.60],milk:[.23,.24,.34]},
  {h:6,top:[.44,.57,.73],bottom:[.94,.78,.69],cloud:[1,.90,.85],milk:[.82,.83,.85]},
  {h:8,top:[.25,.59,.82],bottom:[.70,.85,.92],cloud:[1,.98,.94],milk:[.82,.89,.91]},
  {h:12,top:[.16,.53,.82],bottom:[.55,.78,.92],cloud:[1,1,1],milk:[.84,.90,.92]},
  {h:16,top:[.28,.56,.78],bottom:[.81,.80,.81],cloud:[1,.96,.88],milk:[.85,.88,.90]},
  {h:18.5,top:[.29,.27,.48],bottom:[.96,.53,.43],cloud:[1,.76,.65],milk:[.79,.73,.78]},
  {h:20.5,top:[.06,.07,.19],bottom:[.26,.23,.40],cloud:[.43,.42,.60],milk:[.20,.22,.33]},
  {h:22,top:[.025,.045,.11],bottom:[.13,.20,.34],cloud:[.42,.51,.68],milk:[.105,.145,.22]},
  {h:24,top:[.025,.045,.11],bottom:[.13,.20,.34],cloud:[.42,.51,.68],milk:[.105,.145,.22]},
]
function paletteAt(hour: number) {
  const h=((hour%24)+24)%24, index=Math.max(1,SKY.findIndex((s,i)=>i>0&&h<=s.h))
  const a=SKY[index-1], b=SKY[index], t=smooth((h-a.h)/(b.h-a.h))
  const color=(key:'top'|'bottom'|'cloud'|'milk')=>a[key].map((v,i)=>mix(v,b[key][i],t)) as [number,number,number]
  return {top:color('top'),bottom:color('bottom'),cloud:color('cloud'),milk:color('milk')}
}

export function createHeroScene(canvas: HTMLCanvasElement, initial: SceneEnvironment, reduced: boolean): SceneController {
  let env=initial, quiet=reduced, visible=true, disposed=false, lost=false
  let width=1,height=1,dpr=1,elapsed=0,previous=0,frame=0,rain=env.rain,fog=env.fog,wet=env.wetness,spawn=0
  let drops:GlassDrop[]=[],field=createApertureField(new Uint8Array(1),1,1)
  let wetHistory=createWetHistory(1,1),trailImage:ImageData|null=null
  const stats=dropStats()
  const cloudImage=new Image();cloudImage.src='/scene/glass-clouds-v1.webp'
  const mask=document.createElement('canvas'), trail=document.createElement('canvas'), scratch=document.createElement('canvas'),fieldCanvas=document.createElement('canvas')
  const maskCtx=mask.getContext('2d')!, trailCtx=trail.getContext('2d')!, scratchCtx=scratch.getContext('2d')!
  let renderer:THREE.WebGLRenderer|null=null
  try { renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'}) } catch { /* Canvas fallback below. */ }
  const gpu=renderer
  const cloudTexture=new THREE.Texture(cloudImage), letterTexture=new THREE.CanvasTexture(mask), traceTexture=new THREE.CanvasTexture(trail)
  let fieldTexture=new THREE.DataTexture(field.pixels,1,1,THREE.RGBAFormat)
  for(const texture of [cloudTexture,letterTexture,traceTexture]) {texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false}
  const target=()=>new THREE.WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter})
  const skyTarget=target(),blurA=target(),blurB=target(),waterTarget=target()
  const skyUniforms={clouds:{value:cloudTexture},topColor:{value:new THREE.Vector3()},bottomColor:{value:new THREE.Vector3()},cloudColor:{value:new THREE.Vector3()},time:{value:0},aspect:{value:1},night:{value:0},rain:{value:0},sunset:{value:0}}
  const blurUniforms={source:{value:skyTarget.texture},stepSize:{value:new THREE.Vector2()}}
  const glassUniforms={clearSky:{value:skyTarget.texture},softSky:{value:blurB.texture},letters:{value:letterTexture},windowField:{value:fieldTexture},water:{value:waterTarget.texture},traces:{value:traceTexture},resolution:{value:new THREE.Vector2()},milk:{value:new THREE.Vector3()},fog:{value:0},night:{value:0},scrollOffset:{value:0},insetDepth:{value:5}}
  const skyMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:skyFragment,uniforms:skyUniforms,depthTest:false,depthWrite:false})
  const blurMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:blurFragment,uniforms:blurUniforms,depthTest:false,depthWrite:false})
  const glassMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:glassFragment,uniforms:glassUniforms,depthTest:false,depthWrite:false})
  const plane=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(plane,skyMaterial)
  scene.add(mesh)
  const instances=new Float32Array(MAX_DROPS*4),modes=new Float32Array(MAX_DROPS),dropGeometry=new THREE.InstancedBufferGeometry()
  dropGeometry.setIndex(plane.index);dropGeometry.setAttribute('position',plane.getAttribute('position'))
  const instanceAttribute=new THREE.InstancedBufferAttribute(instances,4).setUsage(THREE.DynamicDrawUsage)
  dropGeometry.setAttribute('droplet',instanceAttribute)
  const modeAttribute=new THREE.InstancedBufferAttribute(modes,1).setUsage(THREE.DynamicDrawUsage);dropGeometry.setAttribute('dropMode',modeAttribute)
  const dropMaterial=new THREE.ShaderMaterial({vertexShader:dropVertex,fragmentShader:dropFragment,uniforms:{resolution:{value:new THREE.Vector2()},letters:{value:letterTexture},scrollOffset:{value:0}},depthTest:false,depthWrite:false})
  const dropScene=new THREE.Scene(),dropMesh=new THREE.Mesh(dropGeometry,dropMaterial);dropMesh.frustumCulled=false;dropScene.add(dropMesh)
  const fallback=gpu?null:canvas.getContext('2d'), fallbackSky=document.createElement('canvas'), fallbackSoft=document.createElement('canvas'),fallbackCut=document.createElement('canvas'),fallbackInverse=document.createElement('canvas')
  const fallbackCtx=fallbackSky.getContext('2d')!,softCtx=fallbackSoft.getContext('2d')!

  function bead(anywhere=true,dew=false) {
    const seed=Math.random(),r=dew?1.7+Math.pow(seed,3)*6:1.3+Math.pow(seed,2.8)*9
    for(let i=0;i<12;i++){
      const x=Math.random()*width,y=anywhere?Math.random()*height:-r*2
      if(field.sample(x,y)<-r*.45)return glassDrop(x,y,r,seed)
    }
    return null
  }
  function seedDrops(){drops=[];for(let i=0;i<Math.round(rain*58+fog*32);i++){const d=bead(true,rain<.02);if(d)drops.push(d)}spawn=0}
  function textMask(){
    const w=Math.round(width*dpr),h=Math.round(height*dpr)
    // WebGL immutable texture storage must be released before a canvas changes dimensions.
    if(mask.width!==w||mask.height!==h)letterTexture.dispose()
    mask.width=w;mask.height=h
    const hero=document.querySelector('[data-home-hero]')?.getBoundingClientRect()
    const words:{left:number;right:number;top:number;height:number;inkTop:number;inkHeight:number}[]=[]
    for(const word of document.querySelectorAll<HTMLElement>('[data-sky-word]')) {
      const rect=word.getBoundingClientRect(),style=getComputedStyle(word),font=style.font
      const top=rect.top-(hero?.top??0)
      // The aperture follows the real heading layout and loaded font at every viewport size.
      scratch.width=Math.ceil((rect.width+24)*dpr);scratch.height=Math.ceil((rect.height+12)*dpr)
      scratchCtx.scale(dpr,dpr);scratchCtx.font=font;scratchCtx.textAlign='center';scratchCtx.textBaseline='alphabetic';scratchCtx.fillStyle='#fff'
      scratchCtx.letterSpacing=style.letterSpacing
      const metrics=scratchCtx.measureText(word.innerText),baseline=(rect.height+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2
      words.push({left:rect.left,right:rect.right,top,height:rect.height,inkTop:top+baseline-metrics.actualBoundingBoxAscent,inkHeight:metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent})
      scratchCtx.transform(1,0,-.10,1,rect.height*.05+12,0)
      scratchCtx.fillText(word.innerText,rect.width/2,baseline)
      maskCtx.drawImage(scratch,rect.left*dpr-12*dpr,top*dpr)
    }
    // Warp the actual silhouette once, with bilinear alpha. CPU collisions and GPU edges now agree.
    // Drawing fractional scanline strips independently creates horizontal seams at high DPR.
    const source=maskCtx.getImageData(0,0,w,h).data,warped=maskCtx.createImageData(w,h)
    for(const word of words){
      const row=words.filter(other=>Math.abs(other.top-word.top)<2)
      const inkTop=Math.min(...row.map(item=>item.inkTop)),inkHeight=Math.max(...row.map(item=>item.inkTop+item.inkHeight))-inkTop
      const amplitude=clamp(inkHeight*.075,4,12)*dpr
      for(let y=Math.max(0,Math.floor(word.top*dpr));y<Math.min(h,(word.top+word.height)*dpr);y++){
        const t=(y/dpr-inkTop)/inkHeight
        // Two straight creases align across the row; the three bands keep their normal letter shape.
        const shift=-amplitude*(clamp((t-.32)/.035)-clamp((t-.62)/.035))
        for(let x=Math.max(0,Math.floor((word.left-20)*dpr));x<Math.min(w,(word.right+20)*dpr);x++){
          const sx=x-shift,ix=Math.floor(sx),f=sx-ix
          if(ix<0||ix+1>=w)continue
          const i=(y*w+x)*4,sa=(y*w+ix)*4+3
          warped.data[i]=warped.data[i+1]=warped.data[i+2]=255
          warped.data[i+3]=source[sa]*(1-f)+source[sa+4]*f
        }
      }
    }
    maskCtx.putImageData(warped,0,0)
    if(fallback){
      fallbackInverse.width=w;fallbackInverse.height=h
      const inverse=fallbackInverse.getContext('2d')!;inverse.fillStyle='#000';inverse.fillRect(0,0,w,h)
      inverse.globalCompositeOperation='destination-out';inverse.drawImage(mask,0,0)
    }
    fieldCanvas.width=Math.ceil(width);fieldCanvas.height=Math.ceil(height)
    const fc=fieldCanvas.getContext('2d')!;fc.drawImage(mask,0,0,fieldCanvas.width,fieldCanvas.height)
    const pixels=fc.getImageData(0,0,fieldCanvas.width,fieldCanvas.height).data,alpha=new Uint8Array(fieldCanvas.width*fieldCanvas.height)
    for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3]
    field=createApertureField(alpha,fieldCanvas.width,fieldCanvas.height,1)
    fieldTexture.dispose();fieldTexture=new THREE.DataTexture(field.pixels,field.width,field.height,THREE.RGBAFormat)
    fieldTexture.minFilter=fieldTexture.magFilter=THREE.LinearFilter;fieldTexture.needsUpdate=true
    glassUniforms.windowField.value=fieldTexture;glassUniforms.insetDepth.value=clamp((words[0]?.height??160)*.020,1.7,4.2)
    for(const drop of drops)if(drop.mode==='rim')drop.mode=field.sample(drop.x,drop.y)>0?'cavity':'glass'
    drops=drops.filter(d=>d.mode!=='glass'||field.sample(d.x,d.y)<0)
    letterTexture.needsUpdate=true
  }
  function resize(){
    width=window.innerWidth;height=window.innerHeight;dpr=Math.min(devicePixelRatio||1,width<700?1.5:1.25)
    textMask();traceTexture.dispose();trail.width=Math.round(width*.5);trail.height=Math.round(height*.5)
    wetHistory=createWetHistory(trail.width,trail.height);trailImage=new ImageData(wetHistory.pixels,trail.width,trail.height)
    trailCtx.fillStyle='#000';trailCtx.fillRect(0,0,trail.width,trail.height);traceTexture.needsUpdate=true
    fallbackSky.width=Math.ceil(width*.65);fallbackSky.height=Math.ceil(height*.65);fallbackSoft.width=48;fallbackSoft.height=48
    fallbackCut.width=mask.width;fallbackCut.height=mask.height
    if(gpu){
      gpu.setPixelRatio(dpr);gpu.setSize(width,height,false)
      skyTarget.setSize(Math.ceil(width*.7),Math.ceil(height*.7))
      blurA.setSize(Math.max(24,Math.ceil(width/24)),Math.max(24,Math.ceil(height/24)));blurB.setSize(blurA.width,blurA.height)
      waterTarget.setSize(Math.ceil(width*dpr),Math.ceil(height*dpr))
    }else{canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
    glassUniforms.resolution.value.set(width*dpr,height*dpr);dropMaterial.uniforms.resolution.value.set(width,height)
    seedDrops();paint()
  }
  function waterStep(dt:number){
    spawn+=dt*(rain*9+fog*.8)
    while(spawn>1){if(drops.length<MAX_DROPS){const d=bead(Math.random()<.75,rain<.02);if(d)drops.push(d)}spawn--}
    stepGlassWater(drops,field,rain,fog,dt,stats,(x,y,toX,toY,r)=>{
      wetHistory.deposit(x*.5,y*.5,toX*.5,toY*.5,Math.max(.65,r*.165))
    })
    wetHistory.advance(dt,fog>.2?38:18);if(trailImage)trailCtx.putImageData(trailImage,0,0)
    drops=drops.filter(d=>d.y<height+d.r*3&&d.r>1&&d.age<d.life)
    traceTexture.needsUpdate=true
  }
  function fallbackPaint(colors:ReturnType<typeof paletteAt>){
    if(!fallback)return
    const w=fallbackSky.width,h=fallbackSky.height,rgb=(c:RGB)=>`rgb(${c.map(v=>Math.round(v*255)).join(',')})`
    const gradient=fallbackCtx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,rgb(colors.top));gradient.addColorStop(1,rgb(colors.bottom))
    fallbackCtx.fillStyle=gradient;fallbackCtx.fillRect(0,0,w,h)
    if(cloudImage.complete&&cloudImage.naturalWidth){
      const x=-(elapsed*5)%(w*1.5);fallbackCtx.drawImage(cloudImage,x,-h*.05,w*1.5,h*1.1);fallbackCtx.drawImage(cloudImage,x+w*1.5,-h*.05,w*1.5,h*1.1)
      fallbackCtx.globalCompositeOperation='multiply';fallbackCtx.fillStyle=rgb(colors.cloud);fallbackCtx.fillRect(0,0,w,h);fallbackCtx.globalCompositeOperation='source-over'
    }
    softCtx.drawImage(fallbackSky,0,0,48,48)
    fallback.setTransform(dpr,0,0,dpr,0,0);fallback.filter='blur(40px)';fallback.drawImage(fallbackSoft,-80,-80,width+160,height+160);fallback.filter='none'
    fallback.globalAlpha=.78;fallback.fillStyle=rgb(colors.milk);fallback.fillRect(0,0,width,height);fallback.globalAlpha=1
    const c=fallbackCut.getContext('2d')!
    c.globalCompositeOperation='source-over';c.clearRect(0,0,fallbackCut.width,fallbackCut.height)
    c.drawImage(fallbackSky,0,0,fallbackCut.width,fallbackCut.height);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0)
    c.save();c.globalCompositeOperation='source-atop';c.shadowColor='#172c3f55';c.shadowBlur=4*dpr;c.shadowOffsetX=1.2*dpr;c.shadowOffsetY=2.5*dpr;c.drawImage(fallbackInverse,0,0);c.restore()
    fallback.drawImage(fallbackCut,0,-window.scrollY,width,height)
    for(const d of drops){
      const y=d.y-window.scrollY;if(d.mode==='cavity'&&field.sample(d.x,d.y)<0)continue
      fallback.save();fallback.beginPath();fallback.ellipse(d.x,y,d.r,d.r*(d.mode==='rim'?1.35:1.12),0,0,Math.PI*2);fallback.clip()
      fallback.drawImage(canvas,(d.x-d.r*.8)*dpr,(y-d.r*.8)*dpr,d.r*1.6*dpr,d.r*1.6*dpr,d.x-d.r,y-d.r,d.r*2,d.r*2)
      const g=fallback.createRadialGradient(d.x-d.r*.28,y-d.r*.4,0,d.x,y,d.r);g.addColorStop(0,'#ffffff90');g.addColorStop(.25,'#ffffff08');g.addColorStop(.82,'#142f4c04');g.addColorStop(1,'#163b5130');fallback.fillStyle=g;fallback.fillRect(d.x-d.r,y-d.r*1.6,d.r*2,d.r*3.2);fallback.restore()
    }
  }
  function paint(){
    if(disposed||lost)return
    const colors=paletteAt(env.hour),night=env.light.night
    const glassLight=colors.milk[0]*.2126+colors.milk[1]*.7152+colors.milk[2]*.0722,dark=glassLight<.42
    const root=document.documentElement
    if(root.dataset.skyDark!==String(dark))root.dataset.skyDark=String(dark)
    for(const [key,color]of [['--sky-ink',dark?'#e3eaf3':glassLight<.65?'#0f2437':'#263e4e'],['--sky-muted',dark?'#b6c7dc':glassLight<.65?'#142a3c':'#30495b']]){
      if(root.style.getPropertyValue(key)!==color)root.style.setProperty(key,color)
    }
    skyUniforms.topColor.value.set(...colors.top);skyUniforms.bottomColor.value.set(...colors.bottom);skyUniforms.cloudColor.value.set(...colors.cloud)
    skyUniforms.time.value=quiet?0:elapsed;skyUniforms.aspect.value=width/height;skyUniforms.night.value=night;skyUniforms.rain.value=rain
    glassUniforms.milk.value.set(...colors.milk);glassUniforms.fog.value=fog;glassUniforms.night.value=night;glassUniforms.scrollOffset.value=window.scrollY/height
    dropMaterial.uniforms.scrollOffset.value=window.scrollY/height
    if(gpu){
      mesh.material=skyMaterial;gpu.setClearColor(0,1);gpu.setRenderTarget(skyTarget);gpu.render(scene,camera)
      mesh.material=blurMaterial;blurUniforms.source.value=skyTarget.texture;blurUniforms.stepSize.value.set(3/blurA.width,0);gpu.setRenderTarget(blurA);gpu.render(scene,camera)
      blurUniforms.source.value=blurA.texture;blurUniforms.stepSize.value.set(0,3/blurA.height);gpu.setRenderTarget(blurB);gpu.render(scene,camera)
      drops.forEach((d,i)=>{instances[i*4]=d.x;instances[i*4+1]=height-d.y+window.scrollY;instances[i*4+2]=d.r;instances[i*4+3]=d.mode==='rim'?1.1+Math.min(1,d.held)*.4:1+clamp(d.vy/180)*.35;modes[i]=d.mode==='glass'?0:d.mode==='rim'?1:d.mode==='cavity'?2:3})
      dropGeometry.instanceCount=drops.length;instanceAttribute.needsUpdate=modeAttribute.needsUpdate=true
      gpu.setClearColor(0,0);gpu.setRenderTarget(waterTarget);gpu.render(dropScene,camera)
      mesh.material=glassMaterial;gpu.setClearColor(0,1);gpu.setRenderTarget(null);gpu.render(scene,camera)
    }else fallbackPaint(colors)
    Object.assign(canvas.dataset,{ready:'true',renderer:gpu?'webgl':'canvas',phase:env.phase,weather:env.weather,renderTime:(quiet?0:elapsed).toFixed(3),drops:String(drops.length),slides:String(stats.slides),merges:String(stats.merges),rimContacts:String(stats.contacts),detached:String(stats.detached),landings:String(stats.landings),rimDrops:String(drops.filter(d=>d.mode==='rim').length),cavityDrops:String(drops.filter(d=>d.mode==='cavity').length),fog:fog.toFixed(3),rain:rain.toFixed(3),wetness:wet.toFixed(3),paused:String(!active())})
    canvas.style.opacity='1'
    if(root.dataset.skyRendered!=='true')root.dataset.skyRendered='true'
  }
  function active(){return !disposed&&!lost&&visible&&!document.hidden&&!quiet}
  function tick(now:number){
    frame=0;if(!active())return
    // Thirty frames per second is enough for wind and water, without running a full-screen effect at 120 Hz.
    if(now-previous<1000/(gpu?30:15)){frame=requestAnimationFrame(tick);return}
    const dt=Math.min(.08,(now-previous)/1000);previous=now;elapsed+=dt
    rain=approach(rain,env.rain,2.5,dt);fog=approach(fog,env.fog,3,dt);wet=approach(wet,Math.max(rain,env.wetness),rain>wet?12:100,dt)
    waterStep(dt);paint();frame=requestAnimationFrame(tick)
  }
  function schedule(){if(frame)cancelAnimationFrame(frame);frame=0;previous=performance.now();if(active())frame=requestAnimationFrame(tick)}
  const onResize=()=>{resize();schedule()},onVisibility=()=>{canvas.dataset.paused=String(!active());schedule()}
  const onScroll=()=>{if(quiet&&visible)paint()}
  const onLoss=(event:Event)=>{event.preventDefault();lost=true;canvas.style.opacity='0';canvas.dataset.renderer='fallback';delete document.documentElement.dataset.skyRendered;schedule()}
  const onRestore=()=>{lost=false;cloudTexture.needsUpdate=letterTexture.needsUpdate=traceTexture.needsUpdate=true;resize();schedule()}
  cloudImage.onload=()=>{cloudTexture.needsUpdate=true;canvas.dataset.clouds='ready';paint()}
  cloudImage.onerror=()=>{canvas.dataset.clouds='fallback';paint()}
  window.addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVisibility)
  window.addEventListener('scroll',onScroll,{passive:true})
  canvas.addEventListener('webglcontextlost',onLoss);canvas.addEventListener('webglcontextrestored',onRestore)
  let layoutObserver:ResizeObserver|null=null
  const content=document.querySelector('.sky-hero-content');if(content){layoutObserver=new ResizeObserver(()=>{textMask();paint()});layoutObserver.observe(content)}
  document.fonts.ready.then(()=>{if(!disposed){textMask();paint()}})
  resize();schedule()
  return {
    update(next,nextReduced){
      const changed=next.weather!==env.weather;env=next;quiet=nextReduced
      if(quiet){rain=env.rain;fog=env.fog;wet=Math.max(wet,rain,env.wetness)}
      if(changed&&(env.rain>.02||env.fog>.2)){rain=env.rain;fog=env.fog;if(drops.length<10)seedDrops()}
      paint();schedule()
    },
    setVisible(next){visible=next;canvas.dataset.paused=String(!active());if(next)paint();schedule()},
    destroy(){
      disposed=true;if(frame)cancelAnimationFrame(frame);layoutObserver?.disconnect()
      window.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisibility)
      window.removeEventListener('scroll',onScroll)
      canvas.removeEventListener('webglcontextlost',onLoss);canvas.removeEventListener('webglcontextrestored',onRestore)
      cloudImage.onload=cloudImage.onerror=null
      for(const t of [cloudTexture,letterTexture,traceTexture,fieldTexture,skyTarget,blurA,blurB,waterTarget])t.dispose()
      for(const m of [skyMaterial,blurMaterial,glassMaterial,dropMaterial])m.dispose();dropGeometry.dispose();plane.dispose();gpu?.dispose()
      delete document.documentElement.dataset.skyDark
      delete document.documentElement.dataset.skyRendered
      document.documentElement.style.removeProperty('--sky-ink');document.documentElement.style.removeProperty('--sky-muted')
    },
  }
}
