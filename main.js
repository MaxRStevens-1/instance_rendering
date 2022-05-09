
import { VertexAttributes } from './vertex-attributes'
import { ShaderProgram } from './shader-program'
import { VertexArray } from './vertex-array'
import { Matrix4 } from './matrix'
import { Vector3, Vector4 } from './vector'
import { Terrain } from './terrain'
import { Trimesh, readOBJFile, TrimeshVao } from './trimesh'
import { Camera, TerrianCamera } from './camera'
import { reserveDepthTexture, initializeDepthFbo, initializeDepthProgram, createTexture2d} from './shadow'

let canvas
let attributes
let shaderProgram
let vao
let clipFromEye
let camera
let eyeFromWorld = Matrix4.translate(0, 0, -20)
let moveDelta = 5
let turnDelta = 1

// SHADOW
let depthTextureUnit
let textureFromWorld
let fbo
let depthProgram;
const textDim = 128;

let lightPosition = new Vector3(800, 200, 800)
let lightTarget = new Vector3(400, 100, 0);
let lightCamera;
let lightFromWorld;
let clipFromLight;

const albedo = [.9, .9, .9]
const specularColor = [.3, .8, .9];
const diffuseColor = [.1, .6, .9];
const shininess = 50.0;
const ambientFactor = 0.5;

// OBJECTS
let terrainTrimesh;
let width;
let depth;

const collectibles = [];
const collectiblePositions = []
let degrees = 1;
const pickupSound = new Audio('./pickup.wav')

const objects = []
const objectPositions = []

// Default render function
function render() {
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0.6, 0.6, 0.9, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  shaderProgram.bind()

  // Bling-Fong init
  shaderProgram.setUniform3f('albedo', albedo[0], albedo[1], albedo[2])
  shaderProgram.setUniform3f('specularColor', specularColor[0], specularColor[1], specularColor[2])
  shaderProgram.setUniform3f('diffuseColor', diffuseColor[0], diffuseColor[1], diffuseColor[2])
  shaderProgram.setUniform1f('shininess', shininess)
  shaderProgram.setUniform1f('ambientFactor', ambientFactor)

  shaderProgram.setUniformMatrix4('clipFromEye', clipFromEye)
  shaderProgram.setUniformMatrix4('eyeFromWorld', camera.eyeFromWorld)
  shaderProgram.setUniformMatrix4('worldFromModel', Matrix4.identity())

  shaderProgram.setUniformMatrix4("textureFromWorld", textureFromWorld);
  shaderProgram.setUniform1i("depthTexture", depthTextureUnit);
  
  // Draw terrain
  shaderProgram.setUniform1i('normTexture', 1);
  vao.bind()
  vao.drawIndexed(gl.TRIANGLES)
  vao.unbind()

  // DRAW COLLECTIBLES
  shaderProgram.setUniform3f('albedo', .9, .5, .3)
  shaderProgram.setUniform3f('specularColor', .8, .9, .1)
  shaderProgram.setUniform3f('diffuseColor', .6, .6, .3)
  shaderProgram.setUniform1f('shininess', 99)
  shaderProgram.setUniform1f('ambientFactor', .9)
  for (let i = 0; i < collectibles.length; i++) {
    const collectible = collectibles[i]
    const pos = collectiblePositions[i]
    shaderProgram.setUniformMatrix4('worldFromModel', pos)
    collectible.vao.bind()
    collectible.vao.drawIndexed(gl.TRIANGLES)
    collectible.vao.unbind()
  }

  // DRAW OBJECTS
  shaderProgram.setUniform3f('albedo', albedo[0], albedo[1], albedo[2])
  shaderProgram.setUniform3f('specularColor', specularColor[0], specularColor[1], specularColor[2])
  shaderProgram.setUniform3f('diffuseColor', diffuseColor[0], diffuseColor[1], diffuseColor[2])
  shaderProgram.setUniform1f('shininess', shininess)
  shaderProgram.setUniform1f('ambientFactor', ambientFactor)
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i]
    const pos = objectPositions[i]
    shaderProgram.setUniformMatrix4('worldFromModel', pos)
    object.vao.bind()
    object.vao.drawIndexed(gl.TRIANGLES)
    object.vao.unbind()
  }


  shaderProgram.unbind()
}

// Shadow/Depths render function
function renderDepths(width, height, fbo) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  gl.viewport(0, 0, width, height);
  gl.clear(gl.DEPTH_BUFFER_BIT);

  const clipFromWorld = clipFromLight.multiplyMatrix(lightFromWorld);

  depthProgram.bind();
  
  for (let i = 0; i < collectibles.length; i++) {
    const collectible = collectibles[i]
    const pos = collectiblePositions[i]
    depthProgram.setUniformMatrix4('clipFromWorld', clipFromWorld);
    depthProgram.setUniformMatrix4('worldFromModel', pos)
    collectible.vao.bind()
    collectible.vao.drawIndexed(gl.TRIANGLES)
    collectible.vao.unbind()
  }

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i]
    const pos = objectPositions[i]
    depthProgram.setUniformMatrix4('clipFromWorld', clipFromWorld);
    depthProgram.setUniformMatrix4('worldFromModel', pos)
    object.vao.bind()
    object.vao.drawIndexed(gl.TRIANGLES)
    object.vao.unbind()
  }

  depthProgram.unbind();

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function onResizeWindow() {
  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight
  clipFromEye = Matrix4.fovPerspective(45, canvas.width / canvas.height, 0.1, 5000)
  render()
  renderDepths(textDim, textDim, fbo)
}

async function readImage(url) {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

function imageToGrayscale(image) {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height

  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, image.width, image.height)
  const pixels = context.getImageData(0, 0, image.width, image.height)

  const grays = new Array(image.width * image.height)
  for (let i = 0; i < image.width * image.height; ++i) {
    grays[i] = pixels.data[i * 4]
  }

  return grays
}

async function initialize() {
  canvas = document.getElementById('canvas')
  window.gl = canvas.getContext('webgl2')

  // gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST)

  // SHADOW
  depthTextureUnit = reserveDepthTexture (textDim, textDim, gl.TEXTURE0)
  fbo = initializeDepthFbo (depthTextureUnit)
  depthProgram = initializeDepthProgram()
  getTextFromWorld()

  // TERRAIN TEXTURE  
  const grass = await readImage('./grass.png')
  createTexture2d(grass, gl.TEXTURE1)

  // TERRAIN TRIMESH
  const noise = await readImage('./mapquestmap.png')
  const terrainNoiseElevations = imageToGrayscale(noise)
  const terrain = new Terrain(terrainNoiseElevations, noise.width, noise.height)
  width = terrain.width
  depth = terrain.depth
  terrainTrimesh = terrain.toTrimesh()
  terrainTrimesh.generateNormals()
  terrainTrimesh.bounding_box()
  terrainTrimesh.calculate_centroid()

  // TERRAIN ATTRIBUTES
  const positions = terrainTrimesh.flat_positions()
  const normals = terrainTrimesh.flat_normals()
  const indices = terrainTrimesh.flat_indices()
  const texPositions = terrainTrimesh.flat_tex()

  attributes = new VertexAttributes()
  attributes.addAttribute('position', positions.length / 3, 3, positions)
  attributes.addAttribute('normal', normals.length / 3, 3, normals)
  attributes.addAttribute('flat_texPosition', texPositions.length / 2, 2, texPositions)
  attributes.addIndices(indices)

  // TERRAIN CAMERA
  const from = new Vector3(terrain.width/2, .3, terrain.depth/2)
  const to = new Vector3(0, 0, 0)
  const worldup = new Vector3(0, 1, 0)
  camera = new TerrianCamera (from, to, worldup, terrain, 5)
  
  const vertexSource = `
uniform mat4 clipFromEye;
uniform mat4 eyeFromWorld;
uniform mat4 worldFromModel;
uniform mat4 textureFromWorld;

in vec3 normal;
in vec3 position;
in vec2 flat_texPosition;

out vec3 mixNormal;
out vec3 mixPosition;
out vec4 mixTexPosition;
out vec2 flat_mixTexPosition;

void main() {
  gl_PointSize = 3.0;
  gl_Position = clipFromEye * eyeFromWorld * worldFromModel * vec4(position, 1.0);
  mixNormal = (eyeFromWorld * worldFromModel * vec4(normal.x, -normal.y, normal.z, 0)).xyz;
  mixPosition =  (eyeFromWorld * worldFromModel * vec4(position, 1.0)).xyz;
  mixTexPosition = textureFromWorld * worldFromModel * vec4(position, 1.0);
  flat_mixTexPosition = flat_texPosition;
}
  `;

  const fragmentSource = `
const vec3 lightDirection = normalize(vec3(1.0, 1.0, 3.0));
uniform vec3 albedo;
uniform vec3 diffuseColor;
uniform vec3 specularColor;
uniform float shininess;
uniform float ambientFactor;

uniform sampler2D normTexture;
uniform sampler2D depthTexture;

in vec3 mixNormal;
in vec3 mixPosition;
in vec4 mixTexPosition;
in vec2 flat_mixTexPosition;

out vec4 fragmentColor;

void main() {
  // get normal texture
  vec4 realTexture = texture(normTexture, flat_mixTexPosition); 

  // calculate fragment depth and shadow
  vec4 texPosition = mixTexPosition / mixTexPosition.w;
  float fragmentDepth = texPosition.z;
  float closestDepth = texture(depthTexture, texPosition.xy).r;
  float shadowFactor = closestDepth < fragmentDepth ? 0.5 : 1.0;

  vec3 normal = normalize(mixNormal);
  // specular
  vec3 eyeDirection = normalize(-mixPosition);
  vec3 halfDirection = normalize(eyeDirection + lightDirection);
  float specularity = pow(max(0.0, dot(halfDirection, normal)), shininess);
  vec3 specular = specularity * specularColor;
  // ambient
  float litness = dot(normal, lightDirection);
  vec3 ambient = ambientFactor * albedo * diffuseColor;
  // diffuse
  vec3 diffuse = (1.0 - ambientFactor) * litness * albedo * diffuseColor * shadowFactor;

  vec3 rgb = ambient + diffuse + specular;
  // fragmentColor = vec4(rgb, 1.0);
  fragmentColor = realTexture * vec4(rgb, 1.0);
}
  `;

  shaderProgram = new ShaderProgram(vertexSource, fragmentSource)
  vao = new VertexArray(shaderProgram, attributes)

  await initCollectibles()
  await initializeObjects()

  window.addEventListener('resize', onResizeWindow)
  onResizeWindow()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', () => {
    document.body.requestPointerLock()
  })
  window.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement) {
      camera.yaw(-event.movementX * turnDelta)
      camera.pitch(-event.movementY * turnDelta)
      render()
    }
  })

  onResizeWindow()
  rotateCollectibles()

}

async function initializeObjects() {
  const names = ['./Andross_corrected.obj', './starfox_ship.obj']
  const center = terrainTrimesh.centroid 

  let lines = await readOBJFile('./Andross_corrected.obj')
  const andross = createObject(lines)
  let pos = Matrix4.translate(center.x, center.y + 250, center.z - depth/2 - 50)
  pos = pos.multiplyMatrix(Matrix4.scale(10, 10, 10))
  objects.push(andross)
  objectPositions.push(pos)

  lines = await readOBJFile('./starfox_ship.obj')
  const ship = createObject(lines)
  pos = Matrix4.translate(center.x + 150, center.y + 300, center.z - 30)
  pos = pos.multiplyMatrix(Matrix4.scale(30, 30, 30))
  pos = pos.multiplyMatrix(Matrix4.rotateY(140))
  objects.push(ship)
  objectPositions.push(pos)

  lines = await readOBJFile('./starfox_spiderboss.obj')
  const spider = createObject(lines)
  pos = Matrix4.translate(center.x + width/2-250, center.y, center.z)
  pos = pos.multiplyMatrix(Matrix4.scale(10, 10, 10))
  objects.push(spider)
  objectPositions.push(pos)

  pos = Matrix4.translate(center.x + width/2 - 350, center.y+ 500, center.z + depth/2 - 50)
  pos = pos.multiplyMatrix(Matrix4.scale(30, 30, 30))
  pos = pos.multiplyMatrix(Matrix4.rotateY(200))
  objects.push(ship)
  objectPositions.push(pos)

  lines = await readOBJFile('./desk_poly.obj')
  const desk = createObject(lines)
  pos = Matrix4.translate(center.x - width/2 + 200, center.y-10, center.z)
  pos = pos.multiplyMatrix(Matrix4.scale(100,100,100))
  objects.push(desk)
  objectPositions.push(pos)

  lines = await readOBJFile('./kettle.obj')
  const kettle = createObject(lines)
  pos = Matrix4.translate(center.x - width/2 - 200, center.y+ 500, center.z +500)
  pos = pos.multiplyMatrix(Matrix4.scale(500, 500, 500))
  objects.push(kettle)
  objectPositions.push(pos)

  pos = Matrix4.translate(center.x - 500, center.y + 600, center.z - 500)
  pos = pos.multiplyMatrix(Matrix4.scale(30, 30, 30))
  pos = pos.multiplyMatrix(Matrix4.rotateY(270))
  objects.push(ship)
  objectPositions.push(pos)
}

async function initCollectibles() {
  const name = './super-nintendo.obj';

  let lines = await readOBJFile(name);

  for (let i = 0; i < 5; i++) {
    // create trimesh vao object
    const collectible = createObject(lines)
    collectibles.push(collectible)
    
    // create positions for collectible
    const center = terrainTrimesh.centroid
    let x = Math.random() * width
    let z = Math.random() * depth
    let pos = Matrix4.translate(x, center.y + 60, z)
    pos = pos.multiplyMatrix(Matrix4.scale(40, 40, 40))
    collectiblePositions.push(pos)
  }
}

function createObject(lines) {
  let obj_trimesh = Trimesh.from_OBJ(lines)
  let obj_attributes = new VertexAttributes()
  let positions = obj_trimesh.flat_positions()
  let normals = obj_trimesh.flat_normals()
  let indices = obj_trimesh.flat_indices()
  obj_attributes.addAttribute('position', positions.length / 3, 3, positions)
  obj_attributes.addAttribute('normal', normals.length/3, 3, normals)
  obj_attributes.addIndices(indices)
  let obj_vao = new VertexArray(shaderProgram, obj_attributes)
  let trivao = new TrimeshVao(obj_trimesh.positions, 
                              obj_trimesh.normals, 
                              obj_trimesh.indices, 
                              obj_vao)
  trivao.bounding_box()
  trivao.calculate_centroid()
  return trivao
}

function rotateCollectibles() {
  for (let i = 0; i < collectibles.length; i++) {
    const collectible = collectibles[i]
    let pos = collectiblePositions[i]
    const centroid = collectible.centroid
    const center = new Vector3(centroid.x, 1, centroid.z)
    pos = pos.multiplyMatrix(Matrix4.rotateAroundAxis(center, degrees))
    collectiblePositions[i] = pos
  }
  render()
  requestAnimationFrame(rotateCollectibles)
}

function onKeyDown(event) {
  if (event.key === 'ArrowUp' || event.key == 'w') {
    camera.advance(moveDelta)
  } else if (event.key === 'ArrowDown' || event.key == 's') {
    camera.advance(-moveDelta)
  } else if (event.key === 'ArrowLeft' || event.key == 'a') {
    camera.strafe(-moveDelta)
  } else if (event.key === 'ArrowRight' || event.key == 'd') {
    camera.strafe(moveDelta)
  } else if (event.key == 'q') {
    camera.yaw(turnDelta)
  } else if (event.key == 'e') {
    camera.yaw(-turnDelta)
  }

  // check collectible collisions
  let remove = -1;
  for (let i = 0; i < collectibles.length; i++) {
    const collectible = collectibles[i]
    const pos = collectiblePositions[i]
    const min = pos.multiplyVector(collectible.min)
    const max = pos.multiplyVector(collectible.max)
    if (camera.position.x >= min.x 
        && camera.position.x <= max.x
        && camera.position.z >= min.z 
        && camera.position.z <= max.z) {
          remove = i
          break;
    }
  } 
  // remove if collided with
  if (remove != -1) {
    pickupSound.play()
    collectibles.splice(remove, 1)
    collectiblePositions.splice(remove, 1)
  }
  render()
}

function getTextFromWorld () {
  lightCamera = new Camera(lightPosition, lightTarget, new Vector3(0, 1, 0));
  lightFromWorld = lightCamera.eyeFromWorld;
  clipFromLight = Matrix4.fovPerspective(45, 1, 0.1, 1000);
  const matrices = [
  Matrix4.translate(0.5, 0.5, 0.5),
  Matrix4.scale(0.5, 0.5, 0.5),
  clipFromLight,
  lightFromWorld,
  ];
  textureFromWorld = matrices.reduce((accum, transform) => accum.multiplyMatrix(transform));
}

window.addEventListener('load', initialize)
