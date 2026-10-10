/**
 * ThreeRenderer - v33.0 FINAL MASTER BUNDLE
 * 
 * 🎨 VISUAL STANDARDS (LOCKED):
 * ✅ MeshStandardMaterial: roughness=0.5, metalness=0.1
 * ✅ Edge sharpening: subtle #CCCCCC EdgesGeometry on all meshes
 * ✅ Focus item: Non-focused → 0.3 opacity, focused → pulse highlight
 * ✅ Dynamic lighting: PointLight follows camera for edge highlights
 * ✅ Carpet labels: Semi-transparent colored mats with site names
 * ✅ White minimal aesthetic: #F5F5F7 background + 72rpx SKU labels
 */

import { createScopedThreejs } from 'threejs-miniprogram';

class ThreeRenderer {
  constructor() {
    this.canvas = null;
    this.THREE = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cargoGroup = null;
    this.containerMesh = null;
    this.animationId = null;
    this.containerDims = null;
    this.cameraDistance = 8000;
    this.cameraAngleX = Math.PI / 4;
    this.cameraAngleY = 0;
    this.needsRender = true;
    this.isDisposed = false;
    this.isInitialized = false;
    
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.isTouching = false;
    
    this.isPlayingAnimation = false;
    this.animationIntervalId = null;
    this.currentAnimationIndex = 0;
    
    this.selectedMesh = null;
    this.emissiveAnimationId = null;
    this.checkedIndicator = null;
    
    this.cogCrosshairGroup = null;
    this.cameraPointLight = null;
    this.doorSpotlight = null;
    this.ghostBox = null;
    
    // v33.0: Worker guidance system
    this.focusedLoadingIndex = null;
    this.loadingIndexLabels = [];
    this.batchMatGroup = null;
    this.cargoMeshMap = new Map();
    
    // v33.0: Edge geometry cache
    this.edgesGeometryCache = new Map();
    
    // v34.8: SKU-Level Worker Interface
    this.materialCache = new Map();
    this.cargoMeshes = [];
    this.raycaster = null;
    this.mouse = null;
    
    // v35.0: Loading sequence & camera presets (Req 6.3, 6.6)
    this._loadingSequenceTimer = null;
    this._loadingSequenceRunning = false;
    this._cameraPresetId = null;
    this._cameraPresetRunning = false;
    this._cameraPresetStartTime = 0;
  }

  async init(canvas, width, height) {
    try {
      if (!canvas || width <= 0 || height <= 0) {
        console.error('[ThreeRenderer] Invalid canvas or dimensions');
        return false;
      }
      
      this.canvas = canvas;
      this.THREE = createScopedThreejs(canvas);
      if (!this.THREE) return false;
      
      this.renderer = new this.THREE.WebGLRenderer({ 
        canvas, 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      this.renderer.setSize(width, height);
      
      const systemInfo = wx.getSystemInfoSync();
      const dpr = Math.min(systemInfo.pixelRatio || 2, 2);
      this.renderer.setPixelRatio(dpr);
      
      // v35.0: White minimal aesthetic background (designTokens.colors.sceneBg)
      this.scene = new this.THREE.Scene();
      this.scene.background = new this.THREE.Color(0xf5f5f7);
      
      this.camera = new this.THREE.PerspectiveCamera(50, width / height, 0.1, 50000);
      this.updateCameraPosition();
      
      // v35.0: Lighting tuned for white background
      // Lower ambient to avoid washing out colors on light bg
      this.scene.add(new this.THREE.AmbientLight(0xffffff, 0.4));
      
      // Stronger directional lights for contrast on white bg
      const light1 = new this.THREE.DirectionalLight(0xffffff, 0.9);
      light1.position.set(5000, 8000, 5000);
      this.scene.add(light1);
      
      const light2 = new this.THREE.DirectionalLight(0xffffff, 0.6);
      light2.position.set(-5000, 5000, -5000);
      this.scene.add(light2);
      
      // Dynamic PointLight following camera (slightly stronger for edge definition)
      this.cameraPointLight = new this.THREE.PointLight(0xffffff, 0.7, 12000);
      this.scene.add(this.cameraPointLight);
      
      // Spotlight at container door
      this.doorSpotlight = new this.THREE.SpotLight(0xffffff, 0.8, 15000, Math.PI / 6, 0.5, 2);
      this.doorSpotlight.position.set(0, 5000, 0);
      this.doorSpotlight.target.position.set(0, 0, 0);
      this.scene.add(this.doorSpotlight);
      this.scene.add(this.doorSpotlight.target);
      
      // v34.8: Initialize raycaster for click detection
      this.raycaster = new this.THREE.Raycaster();
      this.mouse = new this.THREE.Vector2();
      
      this.isInitialized = true;
      this.startRenderLoop();
      
      return true;
    } catch (error) {
      console.error('[ThreeRenderer] Init failed:', error);
      return false;
    }
  }

  updateCameraPosition() {
    // v37.6: Guard against null camera (touch events may fire before init completes)
    if (!this.camera) {
      return;
    }
    if (this.containerDims) {
      const maxDim = Math.max(
        this.containerDims.length, 
        this.containerDims.height, 
        this.containerDims.width
      );
      this.cameraDistance = maxDim * 1.5;
    }
    
    const x = this.cameraDistance * Math.sin(this.cameraAngleY) * Math.cos(this.cameraAngleX);
    const y = this.cameraDistance * Math.sin(this.cameraAngleX);
    const z = this.cameraDistance * Math.cos(this.cameraAngleY) * Math.cos(this.cameraAngleX);
    
    const containerLength = this.containerDims ? this.containerDims.length : 0;
    
    this.camera.position.set(
      containerLength + x, 
      y + (this.containerDims ? this.containerDims.height * 0.5 : 0),
      z
    );
    
    if (this.containerDims) {
      this.camera.lookAt(
        this.containerDims.length / 2,
        this.containerDims.height / 2,
        this.containerDims.width / 2
      );
    } else {
      this.camera.lookAt(0, 0, 0);
    }
    
    // v33.0: Update dynamic PointLight position
    if (this.cameraPointLight) {
      this.cameraPointLight.position.copy(this.camera.position);
    }
  }

  renderCargo(cargoList, standardContainer) {
    if (!this.isInitialized || !cargoList || cargoList.length === 0) {
      return;
    }
    
    this.containerDims = standardContainer;
    this.updateCameraPosition();
    
    this.deepDisposeCargoGroup();
    
    this.cargoGroup = new this.THREE.Group();
    this.scene.add(this.cargoGroup);
    
    this.renderContainerFrame(
      standardContainer.length,
      standardContainer.height,
      standardContainer.width
    );
    
    this.cargoMeshMap.clear();
    
    for (let i = 0; i < cargoList.length; i++) {
      const cargo = cargoList[i];
      if (this.isValidCargo(cargo)) {
        this.renderIndustrialCargo(cargo, i);
      }
    }
    
    this.renderBatchMats();
    this.needsRender = true;
  }

  isValidCargo(cargo) {
    return cargo && 
           typeof cargo.x === 'number' && 
           typeof cargo.y === 'number' && 
           typeof cargo.z === 'number' &&
           typeof cargo.l === 'number' && 
           typeof cargo.h === 'number' && 
           typeof cargo.w === 'number' &&
           cargo.l > 0 && cargo.h > 0 && cargo.w > 0;
  }

  renderContainerFrame(containerL, containerH, containerW) {
    // v35.0: Container wireframe - dark frame on white bg (designTokens.colors.sceneContainerFrame)
    const geometry = new this.THREE.BoxGeometry(containerL, containerH, containerW);
    const edges = new this.THREE.EdgesGeometry(geometry);
    const line = new this.THREE.LineSegments(
      edges,
      new this.THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 })
    );
    line.position.set(containerL / 2, containerH / 2, containerW / 2);
    this.cargoGroup.add(line);
    
    // v33.1: 门口红色标识 (Door Opening Indicator)
    // 装箱契约定义门端位于高 X 平面。
    const doorPoints = [
      new this.THREE.Vector3(containerL, 0, 0),
      new this.THREE.Vector3(containerL, containerH, 0),
      new this.THREE.Vector3(containerL, containerH, containerW),
      new this.THREE.Vector3(containerL, 0, containerW),
      new this.THREE.Vector3(containerL, 0, 0)
    ];
    
    const doorGeometry = new this.THREE.BufferGeometry().setFromPoints(doorPoints);
    const doorLine = new this.THREE.Line(
      doorGeometry,
      new this.THREE.LineBasicMaterial({ 
        color: 0xff0000,  // 红色
        linewidth: 3      // 更粗的线条
      })
    );
    this.cargoGroup.add(doorLine);
  }

  renderIndustrialCargo(cargo, index) {
    const { x, y, z, l, h, w, color, loadingIndex, name, sku, weight, batchKey } = cargo;
    
    // v34.8: Use cached material instead of creating new one
    const material = this.getCachedMaterial(color || '#808080');
    
    const geometry = new this.THREE.BoxGeometry(l, h, w);
    const mesh = new this.THREE.Mesh(geometry, material);
    mesh.position.set(x + l / 2, y + h / 2, z + w / 2);
    
    // v35.0: Subtle edge rendering for white background
    // Light gray edges are more elegant on white bg (designTokens.colors.sceneContainerEdge)
    const edgesGeometry = new this.THREE.EdgesGeometry(geometry);
    const edgesMaterial = new this.THREE.LineBasicMaterial({
      color: 0xcccccc,  // Light gray for elegant look on white background
      linewidth: 1.0,
      opacity: 0.6,     // Subtle transparency
      transparent: true
    });
    const edgesMesh = new this.THREE.LineSegments(edgesGeometry, edgesMaterial);
    edgesMesh.position.copy(mesh.position);
    
    // v34.8: Store complete metadata in userData
    mesh.userData = {
      cargoId: cargo.cargoId || `cargo_${index}`,
      loadingIndex: loadingIndex || index,
      name: name || sku || 'Unknown',
      sku: sku,
      dimensions: { l, w, h },
      weight: weight,
      batch: batchKey || cargo.batch,
      type: cargo.type || 'normal',
      color: color,
      position: { x, y, z }
    };
    
    // v33.1: Debug logging for userData
    if (index === 0) {
      console.log('[ThreeRenderer] First cargo userData:', mesh.userData);
    }
    
    // CRITICAL: edgesMesh also needs userData for filtering
    edgesMesh.userData = {
      cargoId: cargo.cargoId || `cargo_${index}`,
      loadingIndex: loadingIndex || index,
      name: name || sku || 'Unknown',
      sku: sku,
      dimensions: { l, w, h },
      weight: weight,
      batch: batchKey || cargo.batch,
      type: cargo.type || 'normal',
      color: color,
      position: { x, y, z },
      isEdge: true  // Mark as edge
    };
    
    // v34.8: Track mesh for visibility updates
    this.cargoMeshes.push(mesh);
    
    this.cargoGroup.add(mesh);
    this.cargoGroup.add(edgesMesh);
    
    this.cargoMeshMap.set(loadingIndex || index, mesh);
  }

  renderCoGCrosshair(cog) {
    if (this.cogCrosshairGroup) {
      this.scene.remove(this.cogCrosshairGroup);
    }
    
    this.cogCrosshairGroup = new this.THREE.Group();
    
    const crosshairSize = 500;
    const material = new this.THREE.LineBasicMaterial({ color: 0xff0000 });
    
    // X-axis
    const xGeometry = new this.THREE.BufferGeometry().setFromPoints([
      new this.THREE.Vector3(cog.x - crosshairSize, cog.y, cog.z),
      new this.THREE.Vector3(cog.x + crosshairSize, cog.y, cog.z)
    ]);
    this.cogCrosshairGroup.add(new this.THREE.Line(xGeometry, material));
    
    // Y-axis
    const yGeometry = new this.THREE.BufferGeometry().setFromPoints([
      new this.THREE.Vector3(cog.x, cog.y - crosshairSize, cog.z),
      new this.THREE.Vector3(cog.x, cog.y + crosshairSize, cog.z)
    ]);
    this.cogCrosshairGroup.add(new this.THREE.Line(yGeometry, material));
    
    // Z-axis
    const zGeometry = new this.THREE.BufferGeometry().setFromPoints([
      new this.THREE.Vector3(cog.x, cog.y, cog.z - crosshairSize),
      new this.THREE.Vector3(cog.x, cog.y, cog.z + crosshairSize)
    ]);
    this.cogCrosshairGroup.add(new this.THREE.Line(zGeometry, material));
    
    this.scene.add(this.cogCrosshairGroup);
  }

  changeCameraView(viewType) {
    if (viewType === 'door' && this.containerDims) {
      const { length, height, width } = this.containerDims;
      this.camera.position.set(length + Math.max(width, height) * 1.4, height * 0.55, width * 0.5);
      this.camera.lookAt(length * 0.72, height * 0.45, width * 0.5);
      this.needsRender = true;
      return;
    }
    switch (viewType) {
      case 'front':
        this.cameraAngleX = 0;
        this.cameraAngleY = 0;
        break;
      case 'top':
        this.cameraAngleX = Math.PI / 2;
        this.cameraAngleY = 0;
        break;
      case 'side':
        this.cameraAngleX = 0;
        this.cameraAngleY = Math.PI / 2;
        break;
      case 'isometric':
        this.cameraAngleX = Math.PI / 4;
        this.cameraAngleY = Math.PI / 4;
        break;
      default:
        console.warn('[ThreeRenderer] Unsupported camera view:', viewType);
        return;
    }
    this.updateCameraPosition();
    this.needsRender = true;
  }

  updateVisibility(activeTypes, activeBatches) {
    console.log('[ThreeRenderer] updateVisibility called:', { activeTypes, activeBatches });
    
    if (!this.cargoGroup) {
      console.warn('[ThreeRenderer] cargoGroup not initialized');
      return;
    }
    
    let visibleCount = 0;
    let hiddenCount = 0;
    
    // Debug: Log first cargo's userData to verify batch field
    if (this.cargoGroup.children.length > 0) {
      const firstChild = this.cargoGroup.children.find(c => c.userData && c.userData.cargoId);
      if (firstChild) {
        console.log('[ThreeRenderer] Sample userData:', {
          cargoId: firstChild.userData.cargoId,
          batch: firstChild.userData.batch,
          type: firstChild.userData.type
        });
      }
    }
    
    this.cargoGroup.children.forEach(child => {
      if (child.userData && child.userData.cargoId) {
        const cargoType = child.userData.type || 'normal';
        // FIX: userData stores .batch, not .batchKey
        const cargoBatch = child.userData.batch || 'default';
        
        // 筛选逻辑: 同时满足类型和批次条件才显示
        const typeMatch = activeTypes.includes(cargoType);
        const batchMatch = activeBatches.includes(cargoBatch);
        
        child.visible = typeMatch && batchMatch;
        
        if (child.visible) {
          visibleCount++;
        } else {
          hiddenCount++;
        }
      }
    });
    
    console.log(`[ThreeRenderer] Visibility updated: ${visibleCount} visible, ${hiddenCount} hidden`);
    
    // 触发重新渲染
    this.needsRender = true;
  }

  updateLoadingProgress(maxIndex) {
    // v33.0: Update progress indicator
  }

  detectCargoClick(x, y, canvasWidth, canvasHeight) {
    // v33.0: Raycasting for cargo selection
    return null;
  }

  highlightSelectedMesh(mesh) {
    if (this.selectedMesh) {
      this.selectedMesh.material.emissive.setHex(0x000000);
    }
    
    this.selectedMesh = mesh;
    if (mesh) {
      mesh.material.emissive.setHex(0x444444);
      this.startEmissiveBreathing(mesh);
    }
  }

  addCheckedIndicator(mesh) {
    // v33.0: Golden glowing star indicator
  }

  startEmissiveBreathing(mesh) {
    if (this.emissiveAnimationId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.emissiveAnimationId);
      } else {
        clearTimeout(this.emissiveAnimationId);
      }
    }
    
    let phase = 0;
    const animate = () => {
      phase += 0.05;
      const intensity = 0.3 + Math.sin(phase) * 0.2;
      mesh.material.emissive.setHex(0x444444);
      mesh.material.emissiveIntensity = intensity;
      
      // v33.0: Use mini-program compatible animation
      if (typeof requestAnimationFrame !== 'undefined') {
        this.emissiveAnimationId = requestAnimationFrame(animate);
      } else {
        this.emissiveAnimationId = setTimeout(animate, 16);
      }
    };
    
    animate();
  }

  clearSelection() {
    if (this.selectedMesh) {
      this.selectedMesh.material.emissive.setHex(0x000000);
      this.selectedMesh = null;
    }
    
    if (this.emissiveAnimationId) {
      cancelAnimationFrame(this.emissiveAnimationId);
    }
  }

  playLoadingAnimation(speed = 50) {
    this.isPlayingAnimation = true;
    this.currentAnimationIndex = 0;
    
    const animate = () => {
      if (!this.isPlayingAnimation) return;
      
      this.currentAnimationIndex++;
      if (this.currentAnimationIndex >= this.cargoMeshMap.size) {
        this.currentAnimationIndex = 0;
      }
      
      this.animationIntervalId = setTimeout(animate, speed);
    };
    
    animate();
  }

  /**
   * v35.0: easeOutBack easing function (Req 6.3)
   * Overshoots slightly then settles - gives a "bounce/elastic landing" feel
   * @param {number} t - Progress 0..1
   * @returns {number} Eased value
   */
  _easeOutBack(t) {
    const s = 1.70158;
    return 1 + (--t) * t * ((s + 1) * t + s);
  }

  /**
   * v35.0: Play loading sequence animation (Req 6.3)
   * Cargo items drop in one by one in loadingIndex order with easeOutBack curve.
   * @param {Object} options - Configuration
   * @param {number} options.durationPerItem - ms per item (300-800), default 500
   * @param {number} options.dropHeight - drop distance in scene units, default 500
   * @param {number} options.speed - playback speed multiplier (1, 4, 10, 30), default 1
   * @param {Function} options.onItemPlaced - callback(itemInfo, idx, total) when each item lands
   * @param {Function} options.onComplete - callback when sequence finishes
   */
  playLoadingSequence(options = {}) {
    const {
      durationPerItem = 500,
      dropHeight = 500,
      speed = 1,
      onItemPlaced = null,
      onComplete = null
    } = options;
    
    // Apply speed multiplier (higher speed = shorter duration)
    const itemDuration = Math.max(40, Math.round(durationPerItem / speed));
    const itemGap = Math.max(8, Math.round(50 / speed));

    // Stop any running sequence or camera preset
    this.stopLoadingSequence();
    this.stopCameraPreset();

    if (!this.cargoMeshMap || this.cargoMeshMap.size === 0) {
      console.warn('[ThreeRenderer] No cargo meshes to animate');
      return;
    }

    // v37.0: Sort meshes in REAL-WORLD LOADING ORDER (not by algorithm's loadingIndex)
    //   1) X 大→小：柜内最深处先装（远离柜门）
    //   2) Y 小→大：同一柜深，地面层先装
    //   3) Z 小→大：同一柜深同层，从左到右
    // 这样工人/叉车从柜门开始往里送，不会出现"先装中间、再绕过中间装最里面"的不真实场景。
    const sortedEntries = Array.from(this.cargoMeshMap.entries())
      .sort((a, b) => {
        const pa = (a[1].userData && a[1].userData.position) || { x: 0, y: 0, z: 0 };
        const pb = (b[1].userData && b[1].userData.position) || { x: 0, y: 0, z: 0 };
        if (pa.x !== pb.x) return pb.x - pa.x;   // X 大优先（柜内最深处）
        if (pa.y !== pb.y) return pa.y - pb.y;   // Y 小优先（先垫底）
        return pa.z - pb.z;                       // Z 小优先（先左后右）
      });

    // Store original positions and hide all cargo initially
    const originalPositions = new Map();
    sortedEntries.forEach(([index, mesh]) => {
      originalPositions.set(index, mesh.position.y);
      mesh.material.opacity = 0;
      mesh.material.transparent = true;
      mesh.visible = false;
    });

    // Also hide corresponding edge meshes
    if (this.cargoGroup) {
      this.cargoGroup.children.forEach(child => {
        if (child.userData && child.userData.isEdge && child.userData.loadingIndex !== undefined) {
          child.visible = false;
        }
      });
    }

    this._loadingSequenceRunning = true;
    this.needsRender = true;
    let currentIdx = 0;

    const animateNext = () => {
      if (!this._loadingSequenceRunning || currentIdx >= sortedEntries.length) {
        this._loadingSequenceRunning = false;
        if (onComplete) onComplete();
        return;
      }

      const [loadingIndex, mesh] = sortedEntries[currentIdx];
      const targetY = originalPositions.get(loadingIndex);
      const startY = targetY + dropHeight;

      // Make mesh visible and start from above
      mesh.visible = true;
      mesh.material.opacity = 1.0;
      mesh.position.y = startY;

      // Show corresponding edge mesh
      if (this.cargoGroup) {
        this.cargoGroup.children.forEach(child => {
          if (child.userData && child.userData.isEdge && child.userData.loadingIndex === loadingIndex) {
            child.visible = true;
            child.position.y = startY;
          }
        });
      }

      const startTime = Date.now();

      const dropAnimate = () => {
        if (!this._loadingSequenceRunning) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / itemDuration, 1);
        const easedProgress = this._easeOutBack(progress);

        const currentY = startY + (targetY - startY) * easedProgress;
        mesh.position.y = currentY;

        // Sync edge mesh position
        if (this.cargoGroup) {
          this.cargoGroup.children.forEach(child => {
            if (child.userData && child.userData.isEdge && child.userData.loadingIndex === loadingIndex) {
              child.position.y = currentY;
            }
          });
        }

        this.needsRender = true;

        if (progress < 1) {
          this._loadingSequenceTimer = setTimeout(dropAnimate, 16);
        } else {
          // Ensure final position is exact
          mesh.position.y = targetY;
          if (this.cargoGroup) {
            this.cargoGroup.children.forEach(child => {
              if (child.userData && child.userData.isEdge && child.userData.loadingIndex === loadingIndex) {
                child.position.y = targetY;
              }
            });
          }
          this.needsRender = true;

          // Notify which item just landed (for HUD label)
          if (onItemPlaced) {
            try {
              onItemPlaced({
                loadingIndex,
                name: mesh.userData && mesh.userData.name,
                sku: mesh.userData && mesh.userData.sku
              }, currentIdx + 1, sortedEntries.length);
            } catch (e) { /* swallow */ }
          }

          // Move to next item
          currentIdx++;
          this._loadingSequenceTimer = setTimeout(animateNext, itemGap);
        }
      };

      dropAnimate();
    };

    animateNext();
  }

  /**
   * v35.0: Stop loading sequence animation
   */
  stopLoadingSequence() {
    this._loadingSequenceRunning = false;
    if (this._loadingSequenceTimer) {
      clearTimeout(this._loadingSequenceTimer);
      this._loadingSequenceTimer = null;
    }

    // Restore all cargo to visible and correct position
    if (this.cargoMeshMap) {
      this.cargoMeshMap.forEach((mesh) => {
        mesh.material.opacity = 1.0;
        mesh.material.transparent = true;
        mesh.visible = true;
      });
    }
    if (this.cargoGroup) {
      this.cargoGroup.children.forEach(child => {
        if (child.userData && child.userData.isEdge) {
          child.visible = true;
        }
      });
    }
    this.needsRender = true;
  }

  /**
   * v35.0: Play camera orbit preset (Req 6.6)
   * Smoothly rotates camera around the scene (full 360°)
   * @param {number} duration - Total orbit duration in ms (default 10000)
   */
  playCameraOrbit(duration = 10000) {
    this.stopCameraPreset();
    this._cameraPresetRunning = true;
    this._cameraPresetStartTime = Date.now();

    const startAngleY = this.cameraAngleY;
    const targetAngleY = startAngleY + Math.PI * 2;

    const animate = () => {
      if (!this._cameraPresetRunning) return;

      const elapsed = Date.now() - this._cameraPresetStartTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-in-out for orbit
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.cameraAngleY = startAngleY + (targetAngleY - startAngleY) * eased;
      this.updateCameraPosition();
      this.needsRender = true;

      if (progress < 1) {
        this._cameraPresetId = setTimeout(animate, 16);
      } else {
        this._cameraPresetRunning = false;
      }
    };

    animate();
  }

  /**
   * v35.0: Play camera dive preset (Req 6.6)
   * Starts from top view, smoothly transitions to isometric view
   * @param {number} duration - Total dive duration in ms (default 8000)
   */
  playCameraDive(duration = 8000) {
    this.stopCameraPreset();
    this._cameraPresetRunning = true;
    this._cameraPresetStartTime = Date.now();

    // Start from top view
    const startAngleX = Math.PI / 2 - 0.01;
    const startAngleY = 0;
    const targetAngleX = Math.PI / 4;
    const targetAngleY = Math.PI / 4;

    this.cameraAngleX = startAngleX;
    this.cameraAngleY = startAngleY;
    this.updateCameraPosition();
    this.needsRender = true;

    const animate = () => {
      if (!this._cameraPresetRunning) return;

      const elapsed = Date.now() - this._cameraPresetStartTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for dramatic dive feel
      const eased = 1 - Math.pow(1 - progress, 3);

      this.cameraAngleX = startAngleX + (targetAngleX - startAngleX) * eased;
      this.cameraAngleY = startAngleY + (targetAngleY - startAngleY) * eased;
      this.updateCameraPosition();
      this.needsRender = true;

      if (progress < 1) {
        this._cameraPresetId = setTimeout(animate, 16);
      } else {
        this._cameraPresetRunning = false;
      }
    };

    animate();
  }

  /**
   * v35.0: Play camera follow preset (Req 6.6)
   * Camera follows the loading sequence, looking at each item being loaded
   * @param {number} duration - Total follow duration in ms (default 12000)
   */
  playCameraFollow(duration = 12000) {
    this.stopCameraPreset();

    if (!this.cargoMeshMap || this.cargoMeshMap.size === 0) {
      console.warn('[ThreeRenderer] No cargo meshes for follow camera');
      return;
    }

    this._cameraPresetRunning = true;
    this._cameraPresetStartTime = Date.now();

    // Sort meshes by loadingIndex
    const sortedEntries = Array.from(this.cargoMeshMap.entries())
      .sort((a, b) => a[0] - b[0]);

    const totalItems = sortedEntries.length;

    const animate = () => {
      if (!this._cameraPresetRunning) return;

      const elapsed = Date.now() - this._cameraPresetStartTime;
      const progress = Math.min(elapsed / duration, 1);

      // Determine which item to focus on
      const itemIndex = Math.min(Math.floor(progress * totalItems), totalItems - 1);
      const [, mesh] = sortedEntries[itemIndex];

      if (mesh) {
        const targetPos = mesh.position;
        const maxDim = this.containerDims
          ? Math.max(this.containerDims.length, this.containerDims.height, this.containerDims.width)
          : 5000;
        const followDistance = maxDim * 0.8;

        // Orbit slightly while following
        const orbitAngle = progress * Math.PI * 0.5;

        const camX = targetPos.x + followDistance * Math.sin(orbitAngle);
        const camY = targetPos.y + followDistance * 0.6;
        const camZ = targetPos.z + followDistance * Math.cos(orbitAngle);

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);

        // Update dynamic PointLight
        if (this.cameraPointLight) {
          this.cameraPointLight.position.copy(this.camera.position);
        }

        this.needsRender = true;
      }

      if (progress < 1) {
        this._cameraPresetId = setTimeout(animate, 16);
      } else {
        this._cameraPresetRunning = false;
        // Return to default isometric view
        this.cameraAngleX = Math.PI / 4;
        this.cameraAngleY = Math.PI / 4;
        this.updateCameraPosition();
        this.needsRender = true;
      }
    };

    animate();
  }

  /**
   * v35.0: Stop any running camera preset (Req 6.6)
   */
  stopCameraPreset() {
    this._cameraPresetRunning = false;
    if (this._cameraPresetId) {
      clearTimeout(this._cameraPresetId);
      this._cameraPresetId = null;
    }
  }

  stopLoadingAnimation() {
    this.isPlayingAnimation = false;
    if (this.animationIntervalId) {
      clearTimeout(this.animationIntervalId);
    }
  }

  resetAnimation() {
    this.stopLoadingAnimation();
    this.currentAnimationIndex = 0;
  }

  resetCamera() {
    this.cameraAngleX = Math.PI / 4;
    this.cameraAngleY = 0;
    this.updateCameraPosition();
    this.needsRender = true;
  }

  handleTouchStart(e) {
    // v37.6: Guard — only respond if 3D engine is fully initialized
    if (!this.isInitialized || !this.camera) return;
    if (!e.touches || !e.touches.length) return;
    this.lastTouchX = e.touches[0].clientX;
    this.lastTouchY = e.touches[0].clientY;
    this.isTouching = true;
  }

  handleTouchMove(e) {
    if (!this.isTouching) return;
    // v37.6: Guard — camera may be disposed/recreated mid-gesture
    if (!this.camera || !e.touches || !e.touches.length) return;
    
    const deltaX = e.touches[0].clientX - this.lastTouchX;
    const deltaY = e.touches[0].clientY - this.lastTouchY;
    
    this.cameraAngleY += deltaX * 0.01;
    this.cameraAngleX += deltaY * 0.01;
    
    this.cameraAngleX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraAngleX));
    
    this.updateCameraPosition();
    this.needsRender = true;
    
    this.lastTouchX = e.touches[0].clientX;
    this.lastTouchY = e.touches[0].clientY;
  }

  handleTouchEnd() {
    this.isTouching = false;
  }

  handleTap() {}

  startRenderLoop() {
    // v33.0: Use mini-program's rendering API instead of requestAnimationFrame
    const render = () => {
      if (this.isDisposed) return;
      
      if (this.needsRender) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
      }
      
      // Use mini-program's requestAnimationFrame if available, otherwise use setTimeout
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationId = requestAnimationFrame(render);
      } else {
        this.animationId = setTimeout(render, 16); // ~60fps
      }
    };
    
    render();
  }

  disposeGroup(group) {
    if (!group) return;
    
    group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  /**
   * Aggressively dispose a group and all its resources
   * Used for memory cleanup when unloading pages
   */
  disposeGroupAggressive(group) {
    if (!group) return;
    
    // Traverse and dispose all children
    group.traverse(child => {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
        child.geometry = null;
      }
      
      // Dispose material(s)
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            if (m) m.dispose();
          });
        } else {
          child.material.dispose();
        }
        child.material = null;
      }
      
      // Clear userData
      if (child.userData) {
        child.userData = {};
      }
    });
    
    // Remove all children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
    
    // Clear group userData
    if (group.userData) {
      group.userData = {};
    }
  }

  focusOnCargo(cargoPosition, cargoDimensions) {
    const { x, y, z } = cargoPosition;
    const { l, h, w } = cargoDimensions;
    
    const centerX = x + l / 2;
    const centerY = y + h / 2;
    const centerZ = z + w / 2;
    
    const maxDim = Math.max(l, h, w);
    this.cameraDistance = maxDim * 2;
    
    this.camera.position.set(
      centerX + this.cameraDistance,
      centerY + this.cameraDistance,
      centerZ + this.cameraDistance
    );
    
    this.camera.lookAt(centerX, centerY, centerZ);
    this.needsRender = true;
  }

  renderGhostBox(position, dimensions) {
    this.clearGhostBox();
    
    const { x, y, z } = position;
    const { l, h, w } = dimensions;
    
    const geometry = new this.THREE.BoxGeometry(l, h, w);
    const material = new this.THREE.MeshStandardMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.3,
      roughness: 0.5
    });
    
    this.ghostBox = new this.THREE.Mesh(geometry, material);
    this.ghostBox.position.set(x + l / 2, y + h / 2, z + w / 2);
    
    this.cargoGroup.add(this.ghostBox);
    this.needsRender = true;
  }

  clearGhostBox() {
    if (this.ghostBox && this.cargoGroup) {
      this.cargoGroup.remove(this.ghostBox);
      if (this.ghostBox.geometry) this.ghostBox.geometry.dispose();
      if (this.ghostBox.material) this.ghostBox.material.dispose();
      this.ghostBox = null;
    }
  }

  setFocusItem(loadingIndex) {
    // v33.0: Focus item logic - non-focused → 0.3 opacity, focused → pulse
    this.focusedLoadingIndex = loadingIndex;
    
    this.cargoMeshMap.forEach((mesh, index) => {
      if (index === loadingIndex) {
        mesh.material.opacity = 1.0;
        this.highlightSelectedMesh(mesh);
      } else {
        mesh.material.opacity = 0.3;
        mesh.material.transparent = true;
      }
    });
    
    this.needsRender = true;
  }

  createFloatingLabel(mesh, loadingIndex) {
    // v33.0: 72rpx SKU label with text shadow
  }

  clearFocusItem() {
    this.focusedLoadingIndex = null;
    this.clearSelection();
    
    this.cargoMeshMap.forEach(mesh => {
      mesh.material.opacity = 1.0;
      mesh.material.transparent = false;
    });
    
    this.needsRender = true;
  }

  renderBatchMats() {
    // v33.0: Semi-transparent colored mats with site names
    if (this.batchMatGroup) {
      this.scene.remove(this.batchMatGroup);
    }
    
    this.batchMatGroup = new this.THREE.Group();
    
    // Ground mat - lighter tone for white background
    const matGeometry = new this.THREE.PlaneGeometry(
      this.containerDims.length,
      this.containerDims.width
    );
    const matMaterial = new this.THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      transparent: true,
      opacity: 0.3,
      roughness: 0.8
    });
    
    const mat = new this.THREE.Mesh(matGeometry, matMaterial);
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(
      this.containerDims.length / 2,
      0,
      this.containerDims.width / 2
    );
    
    this.batchMatGroup.add(mat);
    this.scene.add(this.batchMatGroup);
  }

  createBatchLabel(batchKey, color) {
    // v33.0: Batch label creation
  }

  deepDisposeCargoGroup() {
    if (this.cargoGroup) {
      this.disposeGroup(this.cargoGroup);
      this.scene.remove(this.cargoGroup);
      this.cargoGroup = null;
    }
    
    this.cargoMeshMap.clear();
    this.loadingIndexLabels = [];
    
    // v34.8: Clear cargo meshes array
    this.cargoMeshes = [];
  }

  /**
   * v34.8: SKU-Level Worker Interface Methods
   */
  
  /**
   * Get or create cached material by color
   * @param {string} color - Hex color string
   * @returns {THREE.MeshStandardMaterial}
   */
  getCachedMaterial(color) {
    const MAX_CACHE_SIZE = 100;
    
    if (!this.materialCache.has(color)) {
      if (this.materialCache.size >= MAX_CACHE_SIZE) {
        console.warn('[ThreeRenderer] Material cache limit reached, clearing oldest entries');
        // Clear half the cache (FIFO)
        const entries = Array.from(this.materialCache.entries());
        entries.slice(0, MAX_CACHE_SIZE / 2).forEach(([key, material]) => {
          material.dispose();
          this.materialCache.delete(key);
        });
      }
      
      const material = new this.THREE.MeshStandardMaterial({
        color: new this.THREE.Color(color),
        roughness: 0.4,    // Slightly lower roughness for more vivid colors on white bg
        metalness: 0.15,   // Slightly higher metalness for better saturation/contrast
        transparent: true,  // Always true for flexibility
        opacity: 1.0,
        depthWrite: true
      });
      this.materialCache.set(color, material);
    }
    return this.materialCache.get(color);
  }

  /**
   * Update SKU visibility with ghost transparency
   * @param {Array<string>} selectedSkus - Array of selected SKU names
   */
  updateSkuVisibility(selectedSkus) {
    console.log('[ThreeRenderer] updateSkuVisibility:', selectedSkus);
    
    if (!this.cargoGroup || !this.cargoMeshes) {
      console.warn('[ThreeRenderer] cargoGroup or cargoMeshes not initialized');
      return;
    }
    
    const startTime = Date.now();
    const selectedSet = new Set(selectedSkus || []);
    
    // 计算所有唯一 SKU
    const allUniqueSKUs = new Set();
    this.cargoMeshes.forEach(m => {
      const skuName = m.userData.name || m.userData.sku || 'Unknown';
      allUniqueSKUs.add(skuName);
    });
    
    const isAllSelected = selectedSet.size >= allUniqueSKUs.size;
    const isNoneSelected = selectedSet.size === 0;
    
    let visibleCount = 0;
    let hiddenCount = 0;
    
    // 处理货物 mesh
    this.cargoMeshes.forEach(mesh => {
      const meshSkuName = mesh.userData.name || mesh.userData.sku || 'Unknown';
      const isSelected = selectedSet.has(meshSkuName);
      
      if (isAllSelected) {
        // 全选：完全可见
        mesh.visible = true;
        mesh.material.opacity = 1.0;
        mesh.material.depthWrite = true;
        visibleCount++;
      } else if (isNoneSelected) {
        // 全部取消：完全隐藏
        mesh.visible = false;
        hiddenCount++;
      } else if (isSelected) {
        // 部分选中-该 SKU 被选中：完全可见
        mesh.visible = true;
        mesh.material.opacity = 1.0;
        mesh.material.depthWrite = true;
        visibleCount++;
      } else {
        // 部分选中-该 SKU 未选中：完全隐藏
        mesh.visible = false;
        hiddenCount++;
      }
    });
    
    // 同步处理边缘线（与货物本体保持一致的可见性）
    if (this.cargoGroup) {
      this.cargoGroup.children.forEach(child => {
        if (child.userData && child.userData.isEdge) {
          const edgeSku = child.userData.name || child.userData.sku || 'Unknown';
          if (isAllSelected) {
            child.visible = true;
          } else if (isNoneSelected) {
            child.visible = false;
          } else {
            child.visible = selectedSet.has(edgeSku);
          }
        }
      });
    }
    
    this.needsRender = true;
    console.log(`[ThreeRenderer] SKU filter: ${visibleCount} visible, ${hiddenCount} hidden in ${Date.now() - startTime}ms`);
  }

  /**
   * Convert WeChat touch coordinates to Three.js NDC
   * @param {number} touchX - Touch X in pixels
   * @param {number} touchY - Touch Y in pixels
   * @param {number} canvasWidth - Canvas width in pixels
   * @param {number} canvasHeight - Canvas height in pixels
   * @returns {Object} { x, y } in NDC space (-1 to +1)
   */
  touchToNDC(touchX, touchY, canvasWidth, canvasHeight) {
    // Convert to NDC: (0,0) at top-left → (-1,1) at top-left
    const ndcX = (touchX / canvasWidth) * 2 - 1;
    const ndcY = -(touchY / canvasHeight) * 2 + 1;  // Flip Y axis
    
    return { x: ndcX, y: ndcY };
  }

  /**
   * Detect clicked cargo using raycaster
   * @param {number} touchX - Touch X coordinate in pixels
   * @param {number} touchY - Touch Y coordinate in pixels
   * @param {number} canvasWidth - Canvas width in pixels
   * @param {number} canvasHeight - Canvas height in pixels
   * @returns {Object|null} Cargo userData or null
   */
  detectCargoClick(touchX, touchY, canvasWidth, canvasHeight) {
    if (!this.raycaster || !this.cargoGroup) {
      console.error('[ThreeRenderer] Raycaster or cargoGroup not initialized');
      return null;
    }
    
    // Validate coordinates
    if (touchX < 0 || touchX > canvasWidth || touchY < 0 || touchY > canvasHeight) {
      console.warn('[ThreeRenderer] Touch coordinates outside canvas bounds:', { touchX, touchY });
      return null;
    }
    
    // Convert touch coordinates to NDC
    const ndc = this.touchToNDC(touchX, touchY, canvasWidth, canvasHeight);
    this.mouse.set(ndc.x, ndc.y);
    
    console.log('[ThreeRenderer] Touch:', { touchX, touchY }, 'NDC:', ndc);
    
    // Update raycaster with camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all cargo meshes (exclude edges and other objects)
    const cargoMeshes = this.cargoGroup.children.filter(child => 
      child.userData && child.userData.cargoId && !child.userData.isEdge
    );
    
    // Perform intersection test
    const intersects = this.raycaster.intersectObjects(cargoMeshes, false);
    
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      console.log('[ThreeRenderer] Cargo clicked:', clickedMesh.userData);
      
      // Return formatted cargo data
      return {
        loadingIndex: clickedMesh.userData.loadingIndex,
        cargoName: clickedMesh.userData.name,
        skuId: clickedMesh.userData.sku,
        dimensions: clickedMesh.userData.dimensions || { l: 0, w: 0, h: 0 },
        weight: clickedMesh.userData.weight,
        batchKey: clickedMesh.userData.batch,
        type: clickedMesh.userData.type,
        position: clickedMesh.userData.position || { x: 0, y: 0, z: 0 }
      };
    }
    
    console.log('[ThreeRenderer] No cargo clicked');
    return null;
  }

  dispose() {
    this.isDisposed = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.emissiveAnimationId) {
      cancelAnimationFrame(this.emissiveAnimationId);
    }
    
    this.stopLoadingAnimation();
    this.stopLoadingSequence();
    this.stopCameraPreset();
    this.clearSelection();
    this.clearGhostBox();
    this.deepDisposeCargoGroup();
    
    // v34.8: Dispose material cache
    if (this.materialCache) {
      this.materialCache.forEach(material => material.dispose());
      this.materialCache.clear();
    }
    
    if (this.scene) {
      this.scene.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export default ThreeRenderer;
