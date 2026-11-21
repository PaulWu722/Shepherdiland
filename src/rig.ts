import * as T from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

type Pose = {
  body: T.Object3D; head: T.Object3D; arms: T.Object3D[]; legs: T.Object3D[]
}
const tearPositions = new WeakMap<T.Group, T.Vector3[]>()

function joint(bone: T.Bone, correction = new T.Quaternion()) {
  const parent = bone.parent!.getWorldQuaternion(new T.Quaternion())
  const inverse = parent.clone().invert()
  const rest = inverse.clone().multiply(correction).multiply(parent).multiply(bone.quaternion)
  const delta = new T.Quaternion()
  return (rotation: T.Euler) => {
    bone.quaternion.copy(inverse).multiply(delta.setFromEuler(rotation)).multiply(parent).multiply(rest)
  }
}

export function characterRig(source: T.Group, pose: Pose) {
  const asset = clone(source)
  const bones = new Map<string, T.Bone>()
  asset.traverse(object => {
    if (object instanceof T.Bone) bones.set(object.name.replace(/^mixamorig[:_]?/i, ''), object)
  })
  const hips = bones.get('Hips'), spine = bones.get('Spine') ?? hips, head = bones.get('Head')
  const sides = ['Right', 'Left']
  const arms = sides.map(side => bones.get(side + 'Arm'))
  const legs = sides.map(side => bones.get(side + 'UpLeg'))
  const hasSkin = asset.getObjectByProperty('type', 'SkinnedMesh')
  if (!hasSkin || !hips || !spine || !head || !arms.every(arm => arm) || !legs.every(leg => leg)) return
  const upperArms = arms as T.Bone[], upperLegs = legs as T.Bone[]

  const model = new T.Group(), aligned = new T.Group()
  model.add(aligned)
  aligned.add(asset)
  const at = (bone: T.Bone) => bone.getWorldPosition(new T.Vector3())
  const across = at(upperArms[1]).sub(at(upperArms[0]))
  const forward = across.cross(new T.Vector3(0, 1, 0))
  aligned.rotation.y = -Math.atan2(forward.x, forward.z)
  const bounds = new T.Box3().setFromObject(aligned)
  const height = bounds.max.y - bounds.min.y
  if (!Number.isFinite(height) || height <= 0) return
  const center = bounds.getCenter(new T.Vector3())
  aligned.scale.setScalar(1 / height)
  aligned.position.set(-center.x / height, -bounds.min.y / height, -center.z / height)
  model.updateMatrixWorld(true)

  const lowerArms = upperArms.map((arm, i) => {
    const end = bones.get(sides[i] + 'Hand') ?? bones.get(sides[i] + 'ForeArm')
    const direction = end ? at(end).sub(at(arm)).normalize() : new T.Vector3(0, -1, 0)
    return joint(arm, new T.Quaternion().setFromUnitVectors(direction, new T.Vector3(0, -1, 0)))
  })
  const rotateHead = joint(head), rotateSpine = joint(spine)
  const rotateThighs = upperLegs.map(bone => joint(bone))
  const knees = sides.map(side => bones.get(side + 'Leg'))
  const rotateKnees = knees.map(bone => bone && joint(bone))
  const kneeRotation = new T.Euler()
  const hipsRest = hips.position.clone()
  const knee = knees[0]
  const seatDrop = knee ? at(upperLegs[0]).distanceTo(at(knee)) * .9 : .06
  const hipUp = hips.parent!.worldToLocal(new T.Vector3(0, 1, 0)).sub(hips.parent!.worldToLocal(new T.Vector3()))

  // Attach effects in the normalized character frame, then let the head carry them.
  const effects = new T.Group()
  model.add(effects)
  head.attach(effects)
  let tears = tearPositions.get(source)
  if (!tears) {
    const face = at(head)
    const front = (bounds.max.z - center.z) / height
    const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1))
    tears = [-1, 1].map(side => {
      const x = face.x + side * .075
      const y = T.MathUtils.clamp(face.y + .08, .58, .75)
      ray.ray.origin.set(x, y, front + 1)
      const depth = ray.intersectObject(asset)[0]?.point.z ?? front
      return new T.Vector3(x, y, depth + .009)
    })
    tearPositions.set(source, tears)
  }

  return {
    model, effects, tears,
    apply() {
      const seated = T.MathUtils.clamp(pose.body.position.y / -.22, 0, 1)
      hips.position.copy(hipsRest).addScaledVector(hipUp, -seatDrop * seated)
      rotateSpine(pose.body.rotation)
      rotateHead(pose.head.rotation)
      kneeRotation.x = 1.32 * seated
      for (let i = 0; i < 2; i++) {
        lowerArms[i](pose.arms[i].rotation)
        rotateThighs[i](pose.legs[i].rotation)
        rotateKnees[i]?.(kneeRotation)
      }
    },
  }
}
