import * as THREE from 'three'

import type { CharacterId } from '@game/shared'
import type { InteractionType } from '@/game/GameWorld'

type PreviewGroup = any
type PreviewMesh = any

const WATER_COLOR = 0x1d7ec8
const WATER_HIGHLIGHT = 0x63c0ff
const SAND_COLOR = 0xe5d4a1
const GRASS_COLOR = 0x5f9c4f
const SOIL_COLOR = 0x8d6640
const WOOD_COLOR = 0x7b5130
const SAIL_COLOR = 0xf2eee3
const GOLD_COLOR = 0xe7bf57
const NPC_COLORS: Record<CharacterId, number> = {
  player: 0xd94f41,
  tom: 0xe08a3c,
  sam: 0x4590d7,
  lily: 0x56aa5d,
  jack: 0x8f54c9,
}

function makeMaterial(color: number, roughness = 0.68, metalness = 0.08) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function addMesh(group: PreviewGroup, mesh: PreviewMesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}

function createStage(baseColor: number, ringColor: number) {
  const group = new THREE.Group()

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.5, 0.34, 32),
    makeMaterial(baseColor, 0.94, 0.02),
  )
  addMesh(group, base, 0, -0.2, 0)

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.09, 12, 36),
    makeMaterial(ringColor, 0.52, 0.14),
  )
  rim.rotation.x = Math.PI / 2
  addMesh(group, rim, 0, -0.02, 0)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0x06101a, transparent: true, opacity: 0.22 }),
  )
  shadow.rotation.x = -Math.PI / 2
  addMesh(group, shadow, 0, -0.015, 0)

  return group
}

function addPalm(group: PreviewGroup, x: number, z: number, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 0.8 * scale, 8),
    makeMaterial(0x8f6038, 0.85, 0.04),
  )
  trunk.rotation.z = 0.15
  addMesh(group, trunk, x, 0.3 * scale, z)

  for (let i = 0; i < 5; i += 1) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.24 * scale, 0.65 * scale, 6),
      makeMaterial(0x5ba950, 0.7, 0.03),
    )
    leaf.position.set(x, 0.75 * scale, z)
    leaf.rotation.z = Math.PI / 2
    leaf.rotation.y = (i / 5) * Math.PI * 2
    leaf.rotation.x = 0.3
    group.add(leaf)
  }
}

function addGrassCluster(group: PreviewGroup, x: number, z: number, scale = 1) {
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.045 * scale, 0.26 * scale, 5),
      makeMaterial(0x72b65f, 0.8, 0.02),
    )
    blade.position.set(x + (i - 1.5) * 0.05 * scale, 0.1 * scale, z + (i % 2 === 0 ? -0.05 : 0.05) * scale)
    blade.rotation.z = (i - 1.5) * 0.12
    group.add(blade)
  }
}

function createDefaultPreview() {
  const group = createStage(WATER_COLOR, WATER_HIGHLIGHT)

  const island = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.95, 0.28, 20),
    makeMaterial(SAND_COLOR, 0.95, 0.01),
  )
  addMesh(group, island, 0, 0.03, 0)

  const grass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.54, 0.68, 0.15, 18),
    makeMaterial(GRASS_COLOR, 0.82, 0.04),
  )
  addMesh(group, grass, 0.08, 0.19, -0.05)

  addPalm(group, -0.28, 0.12, 0.9)
  addGrassCluster(group, 0.38, 0.12)
  addGrassCluster(group, 0.08, -0.28, 0.9)

  return group
}

function createFishPreview() {
  const group = createStage(0x195d99, 0x74d0ff)

  const waveA = new THREE.Mesh(
    new THREE.TorusGeometry(0.84, 0.035, 8, 30),
    new THREE.MeshStandardMaterial({ color: 0x8ad6ff, roughness: 0.25, metalness: 0.05 }),
  )
  waveA.rotation.x = Math.PI / 2
  addMesh(group, waveA, 0, 0.02, 0)

  const waveB = waveA.clone()
  waveB.scale.setScalar(0.72)
  addMesh(group, waveB, 0, 0.08, 0)

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 24, 18),
    makeMaterial(0xffa85e, 0.45, 0.08),
  )
  body.scale.set(1.5, 0.75, 0.72)
  addMesh(group, body, 0, 0.38, 0)

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.42, 3),
    makeMaterial(0xff8b43, 0.46, 0.08),
  )
  tail.rotation.z = -Math.PI / 2
  addMesh(group, tail, -0.58, 0.38, 0)

  const finTop = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.24, 3),
    makeMaterial(0xffbf74, 0.48, 0.06),
  )
  finTop.rotation.x = Math.PI / 2
  addMesh(group, finTop, 0, 0.62, 0)

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 10, 10),
    makeMaterial(0xffffff, 0.3, 0.02),
  )
  addMesh(group, eye, 0.38, 0.43, 0.16)

  const pupil = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    makeMaterial(0x17202b, 0.5, 0.01),
  )
  addMesh(group, pupil, 0.41, 0.43, 0.18)

  return group
}

function createFarmPreview() {
  const group = createStage(0x73513a, 0xd4af60)

  const plot = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 1.15),
    makeMaterial(SOIL_COLOR, 0.94, 0.02),
  )
  addMesh(group, plot, 0, 0.03, 0)

  for (let row = 0; row < 4; row += 1) {
    const furrow = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.02, 0.08),
      makeMaterial(0x5c3d2a, 0.95, 0.01),
    )
    addMesh(group, furrow, 0, 0.13, -0.38 + row * 0.25)
  }

  for (let i = 0; i < 7; i += 1) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 0.62, 6),
      makeMaterial(0x8dbd54, 0.76, 0.02),
    )
    const x = -0.48 + i * 0.16
    const z = i % 2 === 0 ? -0.1 : 0.18
    stalk.rotation.z = i % 2 === 0 ? -0.12 : 0.12
    addMesh(group, stalk, x, 0.42, z)

    const grain = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.24, 6),
      makeMaterial(GOLD_COLOR, 0.54, 0.05),
    )
    grain.rotation.z = stalk.rotation.z
    addMesh(group, grain, x + (i % 2 === 0 ? -0.04 : 0.04), 0.7, z)
  }

  return group
}

function createMerchantPreview() {
  const group = createStage(0x1b5b90, 0x88d1ff)

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.42, 0.72),
    makeMaterial(WOOD_COLOR, 0.82, 0.05),
  )
  hull.position.y = 0.22
  hull.rotation.z = -0.04
  group.add(hull)

  const bow = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.36, 4),
    makeMaterial(0x6a4329, 0.82, 0.05),
  )
  bow.rotation.z = Math.PI / 2
  addMesh(group, bow, 0.78, 0.24, 0)

  const stern = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.52, 0.62),
    makeMaterial(0x6f4830, 0.84, 0.05),
  )
  addMesh(group, stern, -0.64, 0.3, 0)

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, 1.38, 8),
    makeMaterial(0x5c3924, 0.9, 0.04),
  )
  addMesh(group, mast, 0.04, 0.95, 0)

  const sail = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.78, 0.03),
    makeMaterial(SAIL_COLOR, 0.7, 0.02),
  )
  sail.position.set(0.36, 1.02, 0.02)
  sail.rotation.y = -0.1
  group.add(sail)

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.13, 0.02),
    makeMaterial(0xc94a42, 0.56, 0.02),
  )
  addMesh(group, flag, 0.18, 1.52, 0)

  for (let i = 0; i < 3; i += 1) {
    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16),
      makeMaterial(GOLD_COLOR, 0.4, 0.32),
    )
    coin.rotation.x = Math.PI / 2
    addMesh(group, coin, -0.16 + i * 0.16, 0.48 + i * 0.05, i % 2 === 0 ? -0.12 : 0.12)
  }

  return group
}

function createNpcPreview(characterId: CharacterId) {
  const group = createStage(0x35543b, 0x89c56b)
  const shirtColor = NPC_COLORS[characterId]

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.76, 6, 10),
    makeMaterial(shirtColor, 0.7, 0.04),
  )
  addMesh(group, body, 0, 0.52, 0)

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 22, 18),
    makeMaterial(0xe8bc96, 0.58, 0.03),
  )
  addMesh(group, head, 0, 1.08, 0)

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 18, 14),
    makeMaterial(0x473223, 0.72, 0.02),
  )
  hair.scale.set(1.05, 0.72, 1.02)
  addMesh(group, hair, 0, 1.19, -0.02)

  const legA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.54, 8),
    makeMaterial(0x334252, 0.74, 0.04),
  )
  addMesh(group, legA, -0.14, 0.12, 0)

  const legB = legA.clone()
  legB.position.x = 0.14
  group.add(legB)

  const armA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.52, 8),
    makeMaterial(shirtColor, 0.72, 0.04),
  )
  armA.rotation.z = 0.58
  addMesh(group, armA, -0.38, 0.64, 0)

  const armB = armA.clone()
  armB.rotation.z = -0.58
  armB.position.x = 0.38
  group.add(armB)

  return group
}

function createDungeonPreview() {
  const group = createStage(0x1a1622, 0x6f3a4a)
  const STONE = 0x4a4658
  const STONE_DARK = 0x2c2933
  const STONE_LIGHT = 0x6c6878
  const VOID = 0x05050a
  const TORCH = 0xff8a3c
  const BONE = 0xe6dfc8

  // Cave mouth backing (the dark void inside)
  const voidPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.0),
    new THREE.MeshBasicMaterial({ color: VOID }),
  )
  addMesh(group, voidPlate, 0, 0.62, -0.04)

  // Layered void glow for depth
  const innerGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x4a1a2a, transparent: true, opacity: 0.6 }),
  )
  addMesh(group, innerGlow, 0, 0.55, -0.035)

  // Arch left pillar
  const pillarL = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 1.05, 0.34),
    makeMaterial(STONE, 0.95, 0.04),
  )
  addMesh(group, pillarL, -0.55, 0.55, 0)

  // Arch right pillar
  const pillarR = pillarL.clone()
  pillarR.position.set(0.55, 0.55, 0)
  group.add(pillarR)

  // Arch keystone (top block)
  const keystone = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.28, 0.36),
    makeMaterial(STONE_LIGHT, 0.92, 0.05),
  )
  addMesh(group, keystone, 0, 1.18, 0)

  // Arch curve approximation: 3 stones forming a top arch
  for (let i = 0; i < 3; i += 1) {
    const t = (i - 1) * 0.42
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.22, 0.32),
      makeMaterial(STONE, 0.94, 0.04),
    )
    block.position.set(t, 1.04, 0)
    block.rotation.z = -t * 0.25
    group.add(block)
  }

  // Loose stones at the base
  for (let i = 0; i < 3; i += 1) {
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.04, 0),
      makeMaterial(STONE_DARK, 0.96, 0.02),
    )
    stone.position.set(-0.6 + i * 0.6, 0.08, 0.32 + (i % 2 === 0 ? 0.04 : -0.04))
    stone.rotation.y = Math.random() * Math.PI
    group.add(stone)
  }

  // Torches: socket + flame on each pillar
  for (const xOff of [-0.55, 0.55]) {
    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8),
      makeMaterial(0x2a2230, 0.9, 0.05),
    )
    addMesh(group, socket, xOff, 0.92, 0.2)

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.2, 8),
      new THREE.MeshStandardMaterial({
        color: TORCH,
        emissive: TORCH,
        emissiveIntensity: 0.85,
        roughness: 0.4,
      }),
    )
    addMesh(group, flame, xOff, 1.08, 0.2)

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshBasicMaterial({ color: TORCH, transparent: true, opacity: 0.22 }),
    )
    addMesh(group, halo, xOff, 1.06, 0.2)
  }

  // Skull on the threshold
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 14, 12),
    makeMaterial(BONE, 0.78, 0.02),
  )
  skull.scale.set(1, 0.92, 1.02)
  addMesh(group, skull, 0.18, 0.07, 0.36)

  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.025, 0.06),
    makeMaterial(BONE, 0.78, 0.02),
  )
  addMesh(group, jaw, 0.18, 0.018, 0.4)

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x080808 }),
  )
  addMesh(group, eyeL, 0.155, 0.085, 0.43)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.205
  group.add(eyeR)

  // Boss "menace" silhouette: red eyes deep in the cave
  const menaceEyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a }),
  )
  addMesh(group, menaceEyeL, -0.13, 0.7, -0.02)
  const menaceEyeR = menaceEyeL.clone()
  menaceEyeR.position.x = 0.13
  group.add(menaceEyeR)

  return group
}

export function createInteractionPreviewObject(interaction: InteractionType) {
  if (!interaction) return createDefaultPreview()

  switch (interaction.kind) {
    case 'fish':
      return createFishPreview()
    case 'farm':
      return createFarmPreview()
    case 'merchant':
      return createMerchantPreview()
    case 'dungeon':
      return createDungeonPreview()
    case 'npc':
      return createNpcPreview(interaction.characterId)
  }
}

export function disposeObject3D(root: any) {
  root.traverse((node: any) => {
    const mesh = node as any
    if (mesh.geometry) {
      mesh.geometry.dispose()
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!material) continue
      material.dispose()
    }
  })
}
