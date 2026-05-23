import * as THREE from 'three'

import type { InteractionType } from '@/game/GameWorld'
import { createInteractionPreviewObject, disposeObject3D } from './interactionPreviewModels'
import { getInteractionPreviewKey } from './interactionPreviewMeta'

export class InteractionPreviewRenderer {
  private renderer: any = null
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  private resizeObserver: ResizeObserver | null = null
  private container: HTMLElement | null = null
  private previewGroup = new THREE.Group()
  private activeObject: any = null
  private activeKey = ''
  private isRunning = false
  private onVisibilityChange = () => {
    if (document.hidden) {
      this.stop()
      return
    }
    this.start()
  }

  constructor() {
    this.scene.add(this.previewGroup)
    this.scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x1f3646, 1.35))

    const key = new THREE.DirectionalLight(0xfff2d6, 1.55)
    key.position.set(3.8, 5.2, 4.4)
    this.scene.add(key)

    const fill = new THREE.DirectionalLight(0x6cbcff, 0.8)
    fill.position.set(-3.2, 2.4, 2.6)
    this.scene.add(fill)

    this.camera.position.set(0, 1.35, 4.65)
    this.camera.lookAt(0, 0.55, 0)
  }

  init(container: HTMLElement) {
    if (this.renderer) return

    this.container = container
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibilityChange)

    this.resize()
    this.start()
  }

  setInteraction(interaction: InteractionType) {
    const nextKey = getInteractionPreviewKey(interaction)
    if (nextKey === this.activeKey) return

    if (this.activeObject) {
      this.previewGroup.remove(this.activeObject)
      disposeObject3D(this.activeObject)
      this.activeObject = null
    }

    this.activeObject = createInteractionPreviewObject(interaction)
    this.previewGroup.add(this.activeObject)
    this.activeKey = nextKey
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.stop()

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    if (this.activeObject) {
      this.previewGroup.remove(this.activeObject)
      disposeObject3D(this.activeObject)
      this.activeObject = null
    }

    this.scene.clear()

    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
      this.renderer = null
    }

    this.container = null
    this.activeKey = ''
  }

  private start() {
    if (!this.renderer || this.isRunning) return
    this.renderer.setAnimationLoop((timeMs: number) => this.render(timeMs * 0.001))
    this.isRunning = true
  }

  private stop() {
    if (!this.renderer || !this.isRunning) return
    this.renderer.setAnimationLoop(null)
    this.isRunning = false
  }

  private resize() {
    if (!this.renderer || !this.container) return

    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (!width || !height) return

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private render(time: number) {
    if (!this.renderer) return

    if (this.activeObject) {
      this.activeObject.rotation.y = time * 0.8
      this.activeObject.position.y = Math.sin(time * 1.6) * 0.06
    }

    this.previewGroup.rotation.x = Math.sin(time * 0.35) * 0.03
    this.renderer.render(this.scene, this.camera)
  }
}
