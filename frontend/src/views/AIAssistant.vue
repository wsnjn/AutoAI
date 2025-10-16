<template>
  <div class="model-viewer-page">
    <div class="page-header">
      <h1>🎮 3D模型展示</h1>
      <div class="model-status">🎯 模型在线</div>
    </div>
    
    <div class="model-container">
      <div class="model-display">
        <ModelViewer :current-model-name="currentModel" />
      </div>
      
      <div class="model-controls">
        <h3>模型选择</h3>
        <div class="control-buttons">
          <button @click="switchModel('cute_home_robot.glb')" 
                  :class="{ active: currentModel === 'cute_home_robot.glb' }">
            🤖 机器人模型
          </button>
          <button @click="switchModel('shiba.glb')" 
                  :class="{ active: currentModel === 'shiba.glb' }">
            🐕 柴犬模型
          </button>
          <button @click="switchModel('11glb.glb')" 
                  :class="{ active: currentModel === '11glb.glb' }">
            🎨 其他模型
          </button>
        </div>
        
        <div class="model-info">
          <h4>当前模型: {{ getModelName(currentModel) }}</h4>
          <p>使用鼠标拖拽旋转查看模型，支持缩放和平移操作</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import ModelViewer from '../components/ModelViewer.vue'

export default {
  name: 'ModelViewerPage',
  components: {
    ModelViewer
  },
  data() {
    return {
      currentModel: 'cute_home_robot.glb'
    }
  },
  methods: {
    switchModel(modelName) {
      this.currentModel = modelName
    },
    getModelName(modelFile) {
      const modelNames = {
        'cute_home_robot.glb': '可爱家庭机器人',
        'shiba.glb': '柴犬',
        '11glb.glb': '其他3D模型'
      }
      return modelNames[modelFile] || '未知模型'
    }
  }
}
</script>

<style scoped>
.model-viewer-page {
  padding: 20px;
  color: #333;
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.model-status {
  padding: 8px 16px;
  background: #e8f5e8;
  color: #2e7d32;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.model-container {
  flex: 1;
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.model-display {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}

.model-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.model-controls h3 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
  text-align: center;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-buttons button {
  padding: 15px 20px;
  border: 2px solid #e1e5e9;
  background: white;
  color: #333;
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
}

.control-buttons button:hover {
  border-color: #23a6d5;
  background: #f8f9fa;
  transform: translateY(-2px);
}

.control-buttons button.active {
  border-color: #23a6d5;
  background: linear-gradient(45deg, #23a6d5, #23d5ab);
  color: white;
}

.model-info {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}

.model-info h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 1.1rem;
}

.model-info p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .model-container {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .model-display {
    min-height: 300px;
  }
  
  .control-buttons {
    flex-direction: row;
    flex-wrap: wrap;
  }
  
  .control-buttons button {
    flex: 1;
    min-width: 120px;
  }
}
</style>
