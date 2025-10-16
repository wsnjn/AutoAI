const projectTypeConfigs = {
  html: {
    name: 'HTML项目',
    icon: '🌐',
    techStack: 'HTML5, CSS3, JavaScript, Bootstrap',
    aiPrompt: `你是一个专业的HTML前端开发专家。请帮助用户构建一个现代化的HTML项目。

项目要求：
- 使用HTML5语义化标签
- 响应式设计，支持移动端
- 现代化的CSS样式
- 交互式JavaScript功能
- 良好的代码结构和注释
- **重要：将所有CSS和JavaScript代码直接内联到HTML文件中，不要创建外部文件**

请根据用户的需求，提供：
1. 完整的HTML结构，包含内联的CSS样式（在<style>标签中）
2. 内联的JavaScript功能（在<script>标签中）
3. 响应式布局
4. 最佳实践建议

代码格式要求：
- CSS样式必须放在<head>中的<style>标签内
- JavaScript代码必须放在<body>底部的<script>标签内
- 不要使用外部文件引用（如href="styles.css"或src="script.js"）
- 确保代码完整且可独立运行

始终使用中文回复，代码要清晰易懂。`,
    baseStructure: {
      'index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML项目</title>
    <style>
        /* 全局样式 */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
        }
        
        /* 导航栏样式 */
        header {
            background: #2c3e50;
            color: white;
            padding: 1rem 0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        nav {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 2rem;
        }
        
        nav h1 {
            font-size: 1.8rem;
            font-weight: 300;
        }
        
        /* 主要内容区域 */
        main {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4rem 2rem;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .hero h2 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 300;
        }
        
        .hero p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        /* 按钮样式 */
        .btn-primary {
            background: #3498db;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-primary:hover {
            background: #2980b9;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }
        
        /* 页脚样式 */
        footer {
            background: #34495e;
            color: white;
            text-align: center;
            padding: 2rem 0;
            margin-top: 3rem;
        }
        
        /* 响应式设计 */
        @media (max-width: 768px) {
            nav {
                padding: 0 1rem;
            }
            
            nav h1 {
                font-size: 1.5rem;
            }
            
            main {
                padding: 0 1rem;
            }
            
            .hero {
                padding: 2rem 1rem;
            }
            
            .hero h2 {
                font-size: 2rem;
            }
            
            .hero p {
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>
    <header>
        <nav>
            <h1>我的HTML项目</h1>
        </nav>
    </header>
    
    <main>
        <section class="hero">
            <h2>欢迎来到我的项目</h2>
            <p>这是一个现代化的HTML项目</p>
            <button id="cta-btn" class="btn-primary">开始使用</button>
        </section>
    </main>
    
    <footer>
        <p>&copy; 2024 我的项目. All rights reserved.</p>
    </footer>
    
    <script>
        // 页面加载完成后执行
        document.addEventListener('DOMContentLoaded', function() {
            console.log('页面加载完成！');
            
            // 获取按钮元素
            const ctaBtn = document.getElementById('cta-btn');
            
            // 添加点击事件
            ctaBtn.addEventListener('click', function() {
                alert('欢迎使用我的HTML项目！');
                
                // 可以在这里添加更多交互功能
                console.log('用户点击了开始使用按钮');
            });
            
            // 添加页面滚动效果
            window.addEventListener('scroll', function() {
                const header = document.querySelector('header');
                if (window.scrollY > 100) {
                    header.style.background = 'rgba(44, 62, 80, 0.95)';
                    header.style.backdropFilter = 'blur(10px)';
                } else {
                    header.style.background = '#2c3e50';
                    header.style.backdropFilter = 'none';
                }
            });
        });
    </script>
</body>
</html>`,
      'package.json': `{
  "name": "html-project",
  "version": "1.0.0",
  "description": "现代化HTML项目",
  "main": "index.html",
  "scripts": {
    "start": "npx http-server . -p 8080",
    "dev": "npx live-server ."
  },
  "keywords": ["html", "css", "javascript"],
  "author": "开发者",
  "license": "MIT"
}`
    }
  },

  vue: {
    name: 'Vue项目',
    icon: '💚',
    techStack: 'Vue3, Vue Router, Pinia, Element Plus',
    aiPrompt: `你是一个专业的Vue.js前端开发专家。请帮助用户构建一个现代化的Vue3项目。

项目要求：
- 使用Vue 3 Composition API
- 组件化开发
- 响应式设计
- 专注于Vue组件预览

重要：只生成Vue组件文件，不生成配置文件！

具体要求：
1. 只生成Vue组件文件：
   - src/App.vue (根组件)
   - src/views/ (页面组件，.vue文件)
   - src/components/ (公共组件，.vue文件)

2. 文件格式要求：
   - 所有组件使用.vue单文件组件格式
   - 每个组件都是独立的，可以单独预览
   - 不使用外部依赖，所有代码内联

3. 代码规范：
   - 使用Vue 3 Composition API
   - 组件结构清晰，包含template、script、style
   - 响应式设计
   - 组件间通过props和emit通信
   - 样式使用scoped避免冲突

4. 禁止生成其他文件：
   - 不要生成index.html
   - 不要生成src/main.js
   - 不要生成src/router/index.js
   - 不要生成package.json
   - 不要生成vite.config.js
   - 不要生成其他配置文件

5. 组件设计要求：
   - 每个组件功能完整，可以独立运行
   - 使用内联样式，不依赖外部CSS
   - 组件名称清晰，功能明确
   - 包含必要的交互功能

请根据用户的需求，提供：
1. 多个页面组件示例
2. 公共组件示例
3. 现代化的UI设计
4. 完整的Vue组件代码

始终使用中文回复，代码要清晰易懂，遵循Vue3最佳实践。`,
    baseStructure: {
      'src/App.vue': `<!-- Vue根组件 -->
<!-- 使用Vue 3 Composition API -->
<!-- 包含基本的应用结构和样式 -->`,
      'src/views/Home.vue': `<!-- 首页组件 -->
<!-- 使用Vue 3 Composition API -->
<!-- 包含响应式设计和交互功能 -->`,
      'src/views/About.vue': `<!-- 关于页面组件 -->
<!-- 使用Vue 3 Composition API -->
<!-- 包含响应式设计和交互功能 -->`,
      'src/components/WelcomeMessage.vue': `<!-- 欢迎消息组件 -->
<!-- 使用Vue 3 Composition API -->
<!-- 可复用的公共组件 -->`,
      'src/components/FeatureList.vue': `<!-- 功能列表组件 -->
<!-- 使用Vue 3 Composition API -->
<!-- 可复用的公共组件 -->`
    }
  },

  android: {
    name: 'Android项目',
    icon: '🤖',
    techStack: 'Java, Kotlin, Android SDK, Gradle',
    aiPrompt: `你是一个专业的Android开发专家。请帮助用户构建一个现代化的Android应用。

项目要求：
- 使用Kotlin作为主要开发语言
- Material Design设计规范
- MVVM架构模式
- Jetpack组件（ViewModel, LiveData, Room等）
- 现代化的UI组件
- 响应式布局

请根据用户的需求，提供：
1. Activity和Fragment代码
2. ViewModel和Repository
3. 布局XML文件
4. 数据模型
5. 最佳实践建议

始终使用中文回复，代码要清晰易懂，遵循Android开发最佳实践。`,
    baseStructure: {
      'build.gradle': `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'com.example.androidproject'
    compileSdk 34

    defaultConfig {
        applicationId "com.example.androidproject"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.7.0'
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}`,
      'src/main/java/com/example/androidproject/MainActivity.kt': `package com.example.androidproject

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.example.androidproject.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var viewModel: MainViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        viewModel = ViewModelProvider(this)[MainViewModel::class.java]

        setupUI()
        observeViewModel()
    }

    private fun setupUI() {
        binding.btnClick.setOnClickListener {
            viewModel.incrementCounter()
        }
    }

    private fun observeViewModel() {
        viewModel.counter.observe(this) { count ->
            binding.tvCounter.text = "点击次数: $count"
        }
    }
}`,
      'src/main/java/com/example/androidproject/MainViewModel.kt': `package com.example.androidproject

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class MainViewModel : ViewModel() {
    private val _counter = MutableLiveData<Int>()
    val counter: LiveData<Int> = _counter

    init {
        _counter.value = 0
    }

    fun incrementCounter() {
        _counter.value = (_counter.value ?: 0) + 1
    }
}`,
      'src/main/res/layout/activity_main.xml': `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <TextView
        android:id="@+id/tv_title"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Android项目"
        android:textSize="24sp"
        android:textStyle="bold"
        app:layout_constraintBottom_toTopOf="@+id/tv_counter"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintVertical_chainStyle="packed" />

    <TextView
        android:id="@+id/tv_counter"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="点击次数: 0"
        android:textSize="18sp"
        android:layout_marginTop="32dp"
        app:layout_constraintBottom_toTopOf="@+id/btn_click"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toBottomOf="@+id/tv_title" />

    <Button
        android:id="@+id/btn_click"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="点击我"
        android:layout_marginTop="32dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toBottomOf="@+id/tv_counter" />

</androidx.constraintlayout.widget.ConstraintLayout>`,
      'AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AndroidProject"
        tools:targetApi="31">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.AndroidProject">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
    }
  },

  miniprogram: {
    name: '小程序',
    icon: '📱',
    techStack: '微信小程序, WXML, WXSS, JavaScript',
    aiPrompt: `你是一个专业的微信小程序开发专家。请帮助用户构建一个现代化的微信小程序。

项目要求：
- 使用微信小程序原生开发
- WXML模板语法
- WXSS样式
- JavaScript逻辑
- 组件化开发
- 响应式设计
- 良好的用户体验

请根据用户的需求，提供：
1. 页面WXML结构
2. WXSS样式文件
3. JavaScript逻辑
4. 组件代码
5. 最佳实践建议

始终使用中文回复，代码要清晰易懂，遵循微信小程序开发最佳实践。`,
    baseStructure: {
      'app.json': `{
  "pages": [
    "pages/index/index",
    "pages/about/about"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#2c3e50",
    "navigationBarTitleText": "小程序项目",
    "navigationBarTextStyle": "white"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}`,
      'app.js': `App({
  onLaunch() {
    console.log('小程序启动')
  },
  globalData: {
    userInfo: null
  }
})`,
      'app.wxss': `/**app.wxss**/
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 200rpx 0;
  box-sizing: border-box;
}

.btn-primary {
  background-color: #2c3e50;
  color: white;
  border-radius: 10rpx;
  padding: 20rpx 40rpx;
  font-size: 32rpx;
}

.btn-primary:active {
  background-color: #34495e;
}`,
      'pages/index/index.wxml': `<view class="container">
  <view class="hero">
    <text class="title">欢迎使用小程序</text>
    <text class="subtitle">这是一个现代化的微信小程序项目</text>
  </view>
  
  <view class="content">
    <button class="btn-primary" bindtap="handleClick">开始使用</button>
  </view>
</view>`,
      'pages/index/index.wxss': `.container {
  padding: 40rpx;
  text-align: center;
}

.hero {
  margin-bottom: 80rpx;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 20rpx;
}

.subtitle {
  display: block;
  font-size: 28rpx;
  color: #666;
}

.content {
  margin-top: 60rpx;
}`,
      'pages/index/index.js': `Page({
  data: {
    counter: 0
  },

  onLoad() {
    console.log('首页加载')
  },

  handleClick() {
    const newCounter = this.data.counter + 1
    this.setData({
      counter: newCounter
    })
    
    wx.showToast({
      title: \`点击了 \${newCounter} 次\`,
      icon: 'success'
    })
  }
})`,
      'pages/about/about.wxml': `<view class="container">
  <view class="about">
    <text class="title">关于我们</text>
    <text class="content">这是一个基于微信小程序的项目</text>
  </view>
</view>`,
      'pages/about/about.wxss': `.container {
  padding: 40rpx;
}

.about {
  text-align: center;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 40rpx;
}

.content {
  display: block;
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}`,
      'pages/about/about.js': `Page({
  onLoad() {
    console.log('关于页面加载')
  }
})`,
      'sitemap.json': `{
  "desc": "关于本文件的更多信息，请参考文档 https://developers.weixin.qq.com/miniprogram/dev/framework/sitemap.html",
  "rules": [{
    "action": "allow",
    "page": "*"
  }]
}`
    }
  },

  react: {
    name: 'React项目',
    icon: '⚛️',
    techStack: 'React, Redux, JSX, Webpack',
    aiPrompt: `你是一个专业的React前端开发专家。请帮助用户构建一个现代化的React项目。

项目要求：
- 使用React 18+版本
- 函数组件和Hooks
- Redux Toolkit进行状态管理
- React Router进行路由管理
- 现代化的UI组件库（Ant Design或Material-UI）
- TypeScript支持（可选）
- 响应式设计

请根据用户的需求，提供：
1. React组件代码
2. Redux状态管理
3. 路由配置
4. 样式文件
5. 最佳实践建议

始终使用中文回复，代码要清晰易懂，遵循React最佳实践。`,
    baseStructure: {
      'package.json': `{
  "name": "react-project",
  "version": "1.0.0",
  "description": "现代化React项目",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "antd": "^5.0.0"
  },
  "devDependencies": {
    "react-scripts": "5.0.1"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}`,
      'public/index.html': `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React项目</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`,
      'src/index.js': `import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import store from './store';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider locale={zhCN}>
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);`,
      'src/App.js': `import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Home from './pages/Home';
import About from './pages/About';
import './App.css';

const { Header, Content, Footer } = Layout;

function App() {
  return (
    <Layout className="layout">
      <Header>
        <div className="logo">
          <h1 style={{ color: 'white', margin: 0 }}>React项目</h1>
        </div>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        React项目 ©2024 Created by Developer
      </Footer>
    </Layout>
  );
}

export default App;`,
      'src/App.css': `.layout {
  min-height: 100vh;
}

.logo {
  float: left;
  width: 120px;
  height: 31px;
  margin: 16px 24px 16px 0;
}

.site-layout-content {
  background: #fff;
  padding: 24px;
  min-height: 280px;
  margin: 16px 0;
}`,
      'src/index.css': `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`,
      'src/pages/Home.js': `import React from 'react';
import { Button, Card } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { increment } from '../store/counterSlice';

function Home() {
  const count = useSelector((state) => state.counter.value);
  const dispatch = useDispatch();

  return (
    <Card title="欢迎使用React项目" style={{ textAlign: 'center' }}>
      <p>这是一个基于React 18的现代化项目</p>
      <p>当前计数: {count}</p>
      <Button type="primary" onClick={() => dispatch(increment())}>
        增加计数
      </Button>
    </Card>
  );
}

export default Home;`,
      'src/pages/About.js': `import React from 'react';
import { Card } from 'antd';

function About() {
  return (
    <Card title="关于我们">
      <p>这是一个基于React的项目</p>
      <p>使用了以下技术栈：</p>
      <ul>
        <li>React 18</li>
        <li>Redux Toolkit</li>
        <li>React Router</li>
        <li>Ant Design</li>
      </ul>
    </Card>
  );
}

export default About;`,
      'src/store/index.js': `import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';

export default configureStore({
  reducer: {
    counter: counterReducer,
  },
});`,
      'src/store/counterSlice.js': `import { createSlice } from '@reduxjs/toolkit';

export const counterSlice = createSlice({
  name: 'counter',
  initialState: {
    value: 0,
  },
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    },
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;

export default counterSlice.reducer;`
    }
  }
}

class ProjectTypeService {
  // 获取项目类型配置
  getProjectTypeConfig(type) {
    return projectTypeConfigs[type] || projectTypeConfigs.vue
  }

  // 获取所有项目类型
  getAllProjectTypes() {
    return Object.keys(projectTypeConfigs).map(type => ({
      type,
      ...projectTypeConfigs[type]
    }))
  }

  // 获取项目类型的AI提示词
  getAIPrompt(type) {
    const config = this.getProjectTypeConfig(type)
    return config.aiPrompt
  }

  // 获取项目类型的基础文件结构
  getBaseStructure(type) {
    const config = this.getProjectTypeConfig(type)
    return config.baseStructure
  }

  // 生成项目初始化文件
  generateProjectFiles(type, projectName) {
    const baseStructure = this.getBaseStructure(type)
    const files = {}

    // 遍历基础结构，替换项目名称
    Object.keys(baseStructure).forEach(filePath => {
      let content = baseStructure[filePath]
      
      // 替换项目名称占位符
      content = content.replace(/项目名称/g, projectName)
      content = content.replace(/html-project/g, projectName)
      content = content.replace(/vue-project/g, projectName)
      content = content.replace(/react-project/g, projectName)
      content = content.replace(/androidproject/g, projectName)
      
      files[filePath] = content
    })

    return files
  }
}

module.exports = new ProjectTypeService()
