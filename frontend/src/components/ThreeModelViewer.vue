<template>
  <div ref="modelContainer" class="model-container"></div>
</template>

<script>
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default {
  name: 'ThreeModelViewer',
  data() {
    return {
      mixer: null,
      animationFrameId: null,
      renderer: null,
      controls: null,
      isDragging: false,
      offsetX: 0,
      offsetY: 0,
      abortController: null,
      isOrbiting: false,
      clickStartPos: null,
      presetAnswers: {
        "你好": "你好！我是一个3D模型查看器，有什么可以帮你的吗？",
        "谢谢": "不客气，很高兴能帮到你！",
        "再见": "再见，欢迎下次再来！",
        "怎么用": "你可以拖动我查看不同角度，点击我可以和我聊天！",
        "帮助": "你可以对我说：你好、谢谢、再见、怎么用等简单指令！",
        "你是谁": "我是一个3D模型查看器，可以加载和展示3D模型！",
        "模型": "这是一个3D模型，你可以用鼠标拖动旋转查看！",
        "叫爸爸": "爸爸！"
      },
      // 添加快捷指令映射
      voiceCommands: {
        "返回登录页面": this.navigateToLogin,
          "跳转到注册页面": this.navigateToRegister,
         "查看历史记录": this.navigateToChatHistory,
         "返回首页":this.navigateToHome,
         "发表文章":this.navigateToArticle,
         "查看论坛":this.navigateToArticleWatch,
         "海绵宝宝":this.navigateToChat,
        // 可以在这里添加更多快捷指令
        // "其他命令": this.otherCommandFunction
      }
    };
  },
  mounted() {
    this.initThree();
    this.setupDrag();
  },
  beforeUnmount() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.renderer) this.renderer.dispose();
    if (this.controls) this.controls.dispose();
    this.removeDragListeners();
  },
  methods: {

    // 初始化Three.js场景、相机、渲染器
    initThree() {
      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(75, 150 / 150, 0.1, 1000);
      camera.position.set(0, 1, 3);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(150, 150);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setClearColor(0x000000, 0); // 透明背景
      this.$refs.modelContainer.appendChild(renderer.domElement);
      this.renderer = renderer;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = false;  // 禁止缩放
      controls.enablePan = false;   // 禁止平移

      // 监听旋转开始和结束，标记状态
      controls.addEventListener('start', () => { this.isOrbiting = true; });
      controls.addEventListener('end', () => { this.isOrbiting = false; });

      this.controls = controls;

      // 绑定点击开始位置，用于判断点击还是拖动
      renderer.domElement.addEventListener('pointerdown', (e) => {
        this.clickStartPos = { x: e.clientX, y: e.clientY };
      });

      // 监听pointerup判断是否点击（无旋转且移动距离小于阈值）
      renderer.domElement.addEventListener('pointerup', (e) => {
        const dx = e.clientX - this.clickStartPos.x;
        const dy = e.clientY - this.clickStartPos.y;
        const moved = Math.hypot(dx, dy);
        if (!this.isOrbiting && moved < 4) {
          this.handleClick();
        }
      });

      // 加载GLB模型
      const loader = new GLTFLoader();
      loader.load(
        "/models/cute_home_robot.glb",
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(0.5, 0.5, 0.5);
          scene.add(model);

          model.traverse((child) => {
            if (child.isMesh) {
              child.userData.clickable = true;
            }
          });

          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach(clip => {
              this.mixer.clipAction(clip).play();
            });
          }

          // 改为监听双击事件启动语音识别
          renderer.domElement.addEventListener('dblclick', () => {
            this.handleClick();
          });

          this.animate(scene, camera, controls, this.mixer);
        },
        undefined,
        (error) => {
          console.error('模型加载失败:', error);
        }
      );
    },

    animate(scene, camera, controls, mixer) {
      this.animationFrameId = requestAnimationFrame(() => this.animate(scene, camera, controls, mixer));
      if (mixer) mixer.update(0.01);
      controls.update();
      this.renderer.render(scene, camera);
    },

    // 设置拖拽事件监听
    setupDrag() {
      const container = this.$refs.modelContainer;
      container.addEventListener('mousedown', this.handleMouseDown);
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    },

    // 移除拖拽监听
    removeDragListeners() {
      const container = this.$refs.modelContainer;
      container.removeEventListener('mousedown', this.handleMouseDown);
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
    },

    // 鼠标按下处理（按住Ctrl+左键才拖拽）
    handleMouseDown(e) {
      if (e.button === 0 && e.ctrlKey) {
        this.isDragging = true;
        const rect = this.$refs.modelContainer.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        if (this.controls) this.controls.enabled = false;
        e.preventDefault();
      }
    },

    // 鼠标移动处理，限制容器在视口内
    handleMouseMove(e) {
      if (!this.isDragging) return;
      const container = this.$refs.modelContainer;
      let x = e.clientX - this.offsetX;
      let y = e.clientY - this.offsetY;
      const maxX = window.innerWidth - container.offsetWidth;
      const maxY = window.innerHeight - container.offsetHeight;
      x = Math.max(0, Math.min(maxX, x));
      y = Math.max(0, Math.min(maxY, y));
      container.style.left = `${x}px`;
      container.style.top = `${y}px`;
    },

    // 鼠标松开，结束拖拽并恢复控制器状态
    handleMouseUp() {
      this.isDragging = false;
      if (this.controls) this.controls.enabled = true;
    },

    // 点击模型触发语音识别
    async handleClick() {
      await this.startSpeechRecognition();
    },

    // 语音识别相关
    startSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("你的浏览器不支持语音识别");
        return Promise.reject("Speech recognition not supported");
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      return new Promise((resolve, reject) => {
        recognition.onstart = () => {
          console.log("🎤 开始监听，请讲话...");
        };

        recognition.onerror = (event) => {
          console.error("语音识别错误:", event.error);
            this.speak("抱歉，我没有听清楚，请再说一遍！");
          reject(new Error("Speech recognition error: " + event.error));
        };

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          console.log("🗣️ 你说的是:", transcript);

          // 首先检查是否匹配预设答案
          if (this.checkPresetAnswers(transcript)) {
            // 如果匹配预设答案，已经执行了对应操作，不需要再处理
            console.log("检测到预设答案，已执行对应操作");
          }
          // 然后检查是否是快捷指令
          else if (this.checkAndExecuteVoiceCommands(transcript)) {
            // 如果是快捷指令，已经执行了对应操作，不需要再处理
            console.log("检测到快捷指令，已执行对应操作");
          }
          // 如果既不是预设答案也不是快捷指令，发送到AI聊天页面
          else {
            this.sendToAIChat(transcript);
          }

          resolve(transcript);
        };

        recognition.onend = () => {
          console.log("语音识别结束");
        };

        recognition.start();
      });
    },

    // 检查是否匹配预设答案
    checkPresetAnswers(text) {
      // 遍历所有预设答案关键词
      for (const [keyword, answer] of Object.entries(this.presetAnswers)) {
        // 检查语音内容是否包含关键词（简单匹配，实际项目可能需要更复杂的匹配逻辑）
        if (text.includes(keyword)) {
          console.log(`检测到预设答案关键词: ${keyword}`);
          // 执行对应的回复
          this.speak(answer);
          return true; // 返回true表示已处理预设答案
        }
      }
      return false; // 返回false表示没有处理预设答案
    },

    // 检查是否是快捷指令
    checkAndExecuteVoiceCommands(text) {
      // 遍历所有快捷指令
      for (const [command, action] of Object.entries(this.voiceCommands)) {
        // 检查语音内容是否包含命令（简单匹配，实际项目可能需要更复杂的匹配逻辑）
        if (text.includes(command)) {
          console.log(`检测到快捷指令: ${command}`);
          // 执行对应的动作
          action();
          return true; // 返回true表示已处理快捷指令
        }
      }
      return false; // 返回false表示没有处理快捷指令
    },

    // 导航到登录页面
    navigateToLogin() {
      // 使用Vue Router进行导航
      this.$router.push('/login');
    },

    // 导航到注册页面
    navigateToRegister() {
      // 使用Vue Router进行导航
      this.$router.push('/register');
    },
// 新增的方法：导航到聊天历史页面
  navigateToChatHistory() {
    // 使用Vue Router进行导航
    this.$router.push('/chat-history');
  },
  navigateToHome() {
    // 使用Vue Router进行导航
    this.$router.push('/home');
  },
  navigateToArticle() {
    // 使用Vue Router进行导航
    this.$router.push('/article');
  },
  navigateToArticleWatch() {
    // 使用Vue Router进行导航
    this.$router.push('/articles-watch');
  },
  navigateToChat() {
    // 使用Vue Router进行导航
    this.$router.push('/chat');
  },
    // 发送问题到AI聊天页面
    async sendToAIChat(question) {
      try {
        console.log(`🤖 发送问题到AI聊天: ${question}`);
        
        // 获取当前用户ID
        let userId = 'default_user';
        try {
          const currentUser = localStorage.getItem('currentUser');
          if (currentUser) {
            const user = JSON.parse(currentUser);
            userId = user.id || user.username || 'default_user';
            console.log('✅ 3D模型获取用户ID:', userId);
          }
        } catch (error) {
          console.error('❌ 3D模型获取用户信息失败:', error);
        }
        
        // 发送到AI聊天API
        const response = await fetch('http://39.108.142.250:3000/api/ai/general-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: question,
            userId: userId
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.response || '抱歉，没有收到有效回复。';
        
        console.log(`🤖 AI回答: ${aiResponse}`);
        
        // 语音朗读AI回答
        this.speak(aiResponse);
        
        // 发射全局事件，用于在聊天页面显示对话
        this.$root.$emit('ai-response', {
          question: question,
          answer: aiResponse,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error('发送到AI聊天失败:', error);
        this.speak('抱歉，AI服务暂时不可用，请稍后重试。');
      }
    },

    // 语音合成
    speak(text) {
      if (!window.speechSynthesis) {
        alert("当前浏览器不支持语音合成");
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "zh-CN";
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    }
  }
};
</script>

<style scoped>
.model-container {
  width: 150px;
  height: 150px;
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999;
  background: transparent;
  cursor: move;
  user-select: none;
  left: auto;
  top: auto;
}
</style>
