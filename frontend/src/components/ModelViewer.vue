<template>
  <div class="model-viewer">
    <div id="model-container" ref="modelContainer"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps({
  currentModelName: {
    type: String,
    default: 'cute_home_robot.glb'
  }
})

const modelContainer = ref(null)
let scene, camera, renderer, model, controls
let animationFrameId
let mixer
let clock = new THREE.Clock()

async function loadModel(modelName) {
  console.log('🎮 开始加载模型', modelName)
  
  if (!modelContainer.value) {
    console.error('❌ modelContainer 未找到')
    return
  }

  console.log('📦 容器尺寸:', {
    width: modelContainer.value.clientWidth,
    height: modelContainer.value.clientHeight
  })

  // 清除旧模型和动画
  if (model) {
    scene.remove(model)
    model = null
  }
  if (mixer) {
    mixer.stopAllAction()
    mixer = null
  }

  // 初始化场景（只在第一次加载时执行）
  if (!scene) {
    console.log('🌍 初始化Three.js场景')
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)

    camera = new THREE.PerspectiveCamera(
      75,
      modelContainer.value.clientWidth / modelContainer.value.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 2, 4)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(modelContainer.value.clientWidth, modelContainer.value.clientHeight)
    modelContainer.value.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.enableZoom = false
    controls.enableRotate = true
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.target.set(0, 0, 0)
    controls.update()

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 1, 1)
    scene.add(directionalLight)

    console.log('✅ Three.js场景初始化完成')
    // 在场景初始化后立即开始动画循环
    animate()
  }

  // 加载当前模型
  const loader = new GLTFLoader()
  const modelUrl = `/models/${modelName}`
  console.log('📁 模型URL:', modelUrl)
  
  try {
    console.log('🔄 开始加载GLB模型...')
    const gltf = await loader.loadAsync(modelUrl)
    console.log('✅ 模型加载成功:', gltf)
    
    model = gltf.scene

    // 根据模型类型调整位置和缩放
    if (modelName === 'cute_home_robot.glb') {
      model.scale.set(1, 1, 1)
      model.position.set(0, -0.6, 0)
    } else if (modelName === 'shiba.glb') {
      model.scale.set(0.5, 0.5, 0.5)
      model.position.set(0, -1, 0)
    } else {
      model.scale.set(1, 1, 1)
      model.position.set(0, 0, 0)
    }

    scene.add(model)
    console.log('🎯 模型已添加到场景')

    // 播放模型动画
    if (gltf.animations && gltf.animations.length > 0) {
      console.log('🎬 播放模型动画')
      mixer = new THREE.AnimationMixer(model)
      const action = mixer.clipAction(gltf.animations[0])
      action.play()
    }
  } catch (err) {
    console.error('❌ 模型加载失败:', err)
    console.error('模型URL:', modelUrl)
  }
}

function animate() {
  animationFrameId = requestAnimationFrame(animate)
  controls.update()
  if (mixer) {
    const delta = clock.getDelta()
    mixer.update(delta)
  }
  renderer.render(scene, camera)
}

function onWindowResize() {
  if (camera && renderer && modelContainer.value) {
    camera.aspect = modelContainer.value.clientWidth / modelContainer.value.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(modelContainer.value.clientWidth, modelContainer.value.clientHeight)
  }
}

onMounted(() => {
  console.log('🚀 ModelViewer组件已挂载')
  console.log('📋 初始模型名称:', props.currentModelName)
  loadModel(props.currentModelName)
  window.addEventListener('resize', onWindowResize)
})

watch(() => props.currentModelName, (newName) => {
  loadModel(newName)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (renderer) renderer.dispose()
})
</script>

<style scoped>
.model-viewer {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
}

#model-container {
  width: 100%;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
}
</style>
