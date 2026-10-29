import * as THREE from 'three'

// One texture pass moves the photographed clouds and water, with separate foliage motion and nocturnal emission.
export function createSceneSurface(image: HTMLImageElement, mask: HTMLCanvasElement, plants: HTMLCanvasElement) {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, depth: false, stencil: false })
  } catch { return null }
  renderer.setPixelRatio(1)
  renderer.setSize(mask.width, mask.height, false)
  const plate = new THREE.Texture(image), regions = new THREE.CanvasTexture(mask), meadow = new THREE.CanvasTexture(plants)
  plate.needsUpdate = true
  plate.minFilter = regions.minFilter = meadow.minFilter = THREE.LinearFilter
  plate.generateMipmaps = regions.generateMipmaps = meadow.generateMipmaps = false
  const uniforms = {
    plate: { value: plate }, regions: { value: regions }, meadow: { value: meadow },
    glowOnly: { value: 0 }, night: { value: 0 },
    time: { value: 0 }, rain: { value: 0 }, runoff: { value: 0 }, fall: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 uvScene; void main(){ uvScene=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `
      precision highp float;
      varying vec2 uvScene;
      uniform sampler2D plate, regions, meadow;
      uniform float time, rain, runoff, fall, glowOnly, night;
      vec4 photo(vec2 p) { return texture2D(plate, clamp(p,vec2(.001),vec2(.999))); }
      void main() {
        vec2 p=uvScene;
        vec3 region=texture2D(regions,p).rgb;
        // A travelling gust affects only the closest flower bed; all other vegetation stays still.
        float phase=fract(time/26.-p.x*.22+p.y*.08);
        float gust=smoothstep(.04,.16,phase)*(1.-smoothstep(.36,.58,phase));
        float leaf=texture2D(meadow,p).r;
        float foreground=1.-smoothstep(.065,.14,p.y);
        vec2 sway=vec2(sin(time*1.65+p.x*17.+p.y*33.)*.0025,
                       sin(time*1.31+p.x*12.+p.y*24.)*.00055)*gust*foreground*leaf;
        vec2 plantUV=clamp(p+sway,vec2(.001),vec2(.999));
        vec3 foliage=texture2D(meadow,plantUV).rgb;
        if(glowOnly>.5) {
          float shimmer=1.+foreground*(-.045+.045*sin(time*.55+p.x*143.+p.y*79.));
          float emission=(foliage.g*.85+foliage.b*.9)*shimmer*night;
          vec3 hue=mix(vec3(1.,.72,.28),vec3(.5,.88,1.),
                       smoothstep(.8,.98,sin(p.x*240.+p.y*113.)*.5+.5)*.28);
          gl_FragColor=vec4(hue*emission,1.);
          return;
        }
        vec3 color=photo(plantUV).rgb;
        // A smooth distance field attenuates cloud drift before the skyline; no displaced binary edge.
        vec2 wind=vec2(sin(time*.025)*.045 + sin(p.y*9.+time*.065)*.006,
                        sin(time*.037)*.009);
        float sky=region.r;
        color=mix(color,photo(p+wind*sky).rgb,sky);
        // Downstream travelling waves displace the actual creek texture and its reflections.
        float downstream=-p.y*130.+time*(2.8+runoff*2.);
        vec2 ripple=vec2(sin(downstream+p.x*75.),cos(downstream*.83-p.x*90.));
        ripple*=vec2(.0028,.0035)*(1.+runoff*.8);
        float water=region.g;
        vec3 movingWater=photo(p+ripple*water).rgb;
        float glint=pow(max(0.,sin(downstream*2.2+sin(p.x*250.))*sin(p.x*390.-time*1.7)),12.);
        movingWater+=vec3(.75,.85,.9)*glint*(.22+rain*.07);
        movingWater*=1.+sin(downstream*.7+p.x*37.)*.075;
        color=mix(color,movingWater,water);
        // Fine descending highlights and turbulence follow the registered waterfall channel.
        float foam=.5+.5*sin(p.y*520.+time*(12.+fall*9.)+sin(p.x*970.+time*2.));
        vec3 falling=photo(p+vec2(sin(p.y*270.+time*2.)*.001, sin(time*4.+p.y*100.)*.003)*region.b).rgb;
        falling=mix(falling,vec3(.86,.94,.98),(.12+foam*.22)*(1.+fall*.4));
        color=mix(color,falling,region.b);
        gl_FragColor=vec4(color,1.);
      }
    `,
  })
  const geometry = new THREE.PlaneGeometry(2, 2), scene = new THREE.Scene(), camera = new THREE.Camera()
  scene.add(new THREE.Mesh(geometry, material))
  let lost = false
  const onLoss = (event: Event) => { event.preventDefault(); lost = true }
  const onRestore = () => { lost = false; plate.needsUpdate = regions.needsUpdate = meadow.needsUpdate = true }
  renderer.domElement.addEventListener('webglcontextlost', onLoss)
  renderer.domElement.addEventListener('webglcontextrestored', onRestore)
  return {
    render(time: number, rain: number, runoff: number, fall: number) {
      if (lost) return null
      uniforms.glowOnly.value = 0
      uniforms.time.value = time; uniforms.rain.value = rain
      uniforms.runoff.value = runoff; uniforms.fall.value = fall
      renderer.render(scene, camera)
      return renderer.domElement
    },
    glow(time: number, night: number) {
      if (lost) return null
      uniforms.time.value = time; uniforms.night.value = night; uniforms.glowOnly.value = 1
      renderer.render(scene, camera)
      return renderer.domElement
    },
    destroy() {
      renderer.domElement.removeEventListener('webglcontextlost', onLoss)
      renderer.domElement.removeEventListener('webglcontextrestored', onRestore)
      plate.dispose(); regions.dispose(); meadow.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.forceContextLoss()
    },
  }
}
