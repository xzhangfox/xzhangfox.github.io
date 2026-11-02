import * as THREE from 'three'

// A single repeating meadow texture supplies perspective motion; the camera and bed stay fixed.
export function createSceneSurface(image: HTMLImageElement) {
  let renderer: THREE.WebGLRenderer
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, depth: false, stencil: false }) }
  catch { return null }
  renderer.setPixelRatio(1)
  const texture = new THREE.Texture(image)
  texture.needsUpdate = true
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping
  const uniforms = { meadow: { value: texture }, time: { value: 0 }, night: { value: 0 }, sunset: { value: 0 }, rain: { value: 0 }, wet: { value: 0 } }
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 uvScene; void main(){ uvScene=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `
      precision highp float;
      varying vec2 uvScene;
      uniform sampler2D meadow;
      uniform float time, night, sunset, rain, wet;
      void main() {
        vec2 p=vec2(uvScene.x,1.-uvScene.y);
        float horizon=.53+.085*p.x+.015*cos(p.x*3.14159265);
        float depth=(p.y-horizon)/(1.-horizon);
        if(depth<0.) discard;
        float distance=1./(depth+.12);
        vec2 grassUV=vec2((p.x-.5)*distance*1.7,distance*.45+time*.008);
        vec3 grass=texture2D(meadow,grassUV).rgb;
        float luma=dot(grass,vec3(.25,.6,.15));
        grass=mix(vec3(luma*.84,luma*1.08,luma*.64),grass,.72);
        vec3 lighting=mix(vec3(.94,1.,.91),vec3(.31,.40,.59),night);
        lighting=mix(lighting,vec3(1.08,.77,.70),sunset*.55);
        grass*=lighting*(1.-rain*.20);
        grass+=vec3(.015,.020,.045)*night;
        vec3 air=mix(vec3(.66,.78,.65),vec3(.11,.16,.24),night);
        air=mix(air,vec3(.67,.47,.48),sunset*.45);
        grass=mix(grass,air,pow(1.-depth,5.)*.52);
        grass+=vec3(.15,.22,.28)*wet*.12*pow(1.-depth,2.);
        gl_FragColor=vec4(grass,smoothstep(0.,.012,depth));
      }
    `,
  })
  const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene(), camera = new THREE.Camera()
  scene.add(new THREE.Mesh(geometry, material))
  let lost = false, size = ''
  const onLoss = (event: Event) => { event.preventDefault(); lost = true }
  const onRestore = () => { lost = false; texture.needsUpdate = true }
  renderer.domElement.addEventListener('webglcontextlost', onLoss)
  renderer.domElement.addEventListener('webglcontextrestored', onRestore)
  return {
    render(width: number, height: number, time: number, night: number, sunset: number, rain: number, wet: number) {
      if (lost) return null
      const next = width + ':' + height
      if (size !== next) { renderer.setSize(width, height, false); size = next }
      uniforms.time.value = time; uniforms.night.value = night; uniforms.sunset.value = sunset
      uniforms.rain.value = rain; uniforms.wet.value = wet
      renderer.render(scene, camera)
      return renderer.domElement
    },
    destroy() {
      renderer.domElement.removeEventListener('webglcontextlost', onLoss)
      renderer.domElement.removeEventListener('webglcontextrestored', onRestore)
      texture.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
