import { Matrix4 } from './matrix'
import { Vector3, Vector4 } from './vector'
import {Terrain} from './terrain'
export class Camera {
  constructor(from, to, worldUp) {
    this.position = from
    this.forward = to.add(this.position.inverse()).normalize()
    this.worldup = worldUp
    this.right = null;
    this.eyeFromWorld = null;
    this.degrees = 0;
    this.clamp = (num, min, max) => Math.min(Math.max(num, min), max);
    this.reorient();
  }

  

  strafe(distance) {
    this.position = this.position.add(this.right.scalarMultiply(distance))
    this.reorient()
  }

  advance(distance) {
    this.position = this.position.add(this.forward.scalarMultiply(distance))
    this.reorient()
  }


  yaw(degrees) {
    const forwardVec4 = new Vector4()
    forwardVec4.setall(this.forward.x, this.forward.y, this.forward.z, 1);
    const yawVec4 = Matrix4.rotateAroundAxis(this.worldup, degrees)
                          .multiplyVector(forwardVec4);
    this.forward = new Vector3(yawVec4.get(0), yawVec4.get(1), yawVec4.get(2));
    this.reorient()
  }

  pitch(degrees) {
    // set degrees
    if (degrees + this.degrees > -80 && degrees + this.degrees < 80) {
      // calculate pitch
      const forwardVec4 = new Vector4()
      forwardVec4.setall(this.forward.x, this.forward.y, this.forward.z, 0);
      const pitchVec4 = Matrix4.rotateAroundAxis(this.right, degrees)
                            .multiplyVector(forwardVec4);
      
      this.forward = new Vector3(pitchVec4.get(0), pitchVec4.get(1), pitchVec4.get(2));
      // this.forward.y = this.clamp(this.forward.y, -0.8, 0.8)
      this.forward = this.forward.normalize()
      this.degrees += degrees
      this.reorient()
    }
  }

  reorient() {
    let translater = Matrix4.translate(
      -this.position.x,
      -this.position.y,
      -this.position.z
    )

    let rotaterMatrix = new Matrix4()
    rotaterMatrix.set(2, 0, -this.forward.x)
    rotaterMatrix.set(2, 1, -this.forward.y)
    rotaterMatrix.set(2, 2, -this.forward.z)
    rotaterMatrix.set(2, 3, 0)

    this.right = this.forward.cross(this.worldup).normalize()
    rotaterMatrix.set(0, 0, this.right.x)
    rotaterMatrix.set(0, 1, this.right.y)
    rotaterMatrix.set(0, 2, this.right.z)
    rotaterMatrix.set(0, 3, 0)

    const up = this.right.cross(this.forward).normalize()
    rotaterMatrix.set(1, 0, up.x)
    rotaterMatrix.set(1, 1, up.y)
    rotaterMatrix.set(1, 2, up.z)
    rotaterMatrix.set(1, 3, 0)
    rotaterMatrix.set(3, 0, 0)
    rotaterMatrix.set(3, 1, 0)
    rotaterMatrix.set(3, 2, 0)
    rotaterMatrix.set(3, 3, 1)


    this.eyeFromWorld = rotaterMatrix.multiplyMatrix(translater)
  }
}
export class TerrianCamera extends Camera {
  constructor (from, to, worldUp, terrain, eyeLevel) {
    super (from, to, worldUp);
    this.terrain = terrain;
    this.eyeLevel = eyeLevel;
    this.buoy()
    this.reorient()
  }


  buoy () {
    //clamp (from.x, 1, 0)
    let terrainMaxX = this.terrain.width
    let terrainMaxZ = this.terrain.depth
    this.position.x = this.clamp (this.position.x, 0, terrainMaxX)
    this.position.z = this.clamp (this.position.z, 0, terrainMaxZ)
    this.position.y = this.terrain.blerp (this.position.x, this.position.z) + this.eyeLevel;
  } 

  elevate(distance) {
    this.eyeLevel = this.eyeLevel + distance
    this.buoy()
    this.reorient()
  }

  strafe(distance) {
    this.position = this.position.add(this.right.scalarMultiply(distance))
    this.buoy()
    this.reorient()
  }

  advance(distance) {
    this.position = this.position.add(this.forward.scalarMultiply(distance))
    this.buoy()
    this.reorient()
  }
}