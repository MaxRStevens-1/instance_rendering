
import { VertexAttributes } from './vertex-attributes'
import { ShaderProgram } from './shader-program'
import { VertexArray } from './vertex-array'
import { Matrix4 } from './matrix'
import { Vector3, Vector4 } from './vector'
import { Terrain } from './terrain'
import { Trimesh, readOBJFile, TrimeshVao } from './trimesh'
import { Camera, TerrianCamera } from './camera'
import { reserveDepthTexture, initializeDepthFbo, initializeDepthProgram} from './shadow'

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
let objects = []
let depthTextureUnit
let textureFromWorld
let fbo
let depthProgram;
const textDim = 128;

let lightPosition = new Vector3(0, 30, 5);
let lightTarget = new Vector3(0, 0, 0);
let lightCamera;
let lightFromWorld;
let clipFromLight;

const albedo = [.6, .6, .3]
const specularColor = [.3, .8, .9];
const diffuseColor = [.1, .6, .9];
const shininess = 99.0;
const ambientFactor = 0.0;

let androssPos = Matrix4.scale(5, 5, 5).multiplyMatrix(Matrix4.translate(100, 30, 10))

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
  
  vao.bind()
  vao.drawIndexed(gl.TRIANGLES)
  vao.unbind()

// SHADOW
  // for each object
    //   set object's worldFromModel uniform
    //   draw object
// SHADOW

  for (let object of objects) {
    shaderProgram.setUniformMatrix4('worldFromModel', androssPos)
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
  // for each object
  //   clipFromModel = clipFromWorld * object's worldFromModel
  //   set clipFromModel uniform
  //   draw object
  for (let object of objects) {
    depthProgram.setUniformMatrix4('clipFromWorld', clipFromWorld);
    depthProgram.setUniformMatrix4('worldFromModel', androssPos)
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
  clipFromEye = Matrix4.fovPerspective(
    45,
    canvas.width / canvas.height,
    0.1,
    500
  )
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

  //SHADOW
  depthTextureUnit = reserveDepthTexture (textDim, textDim, gl.TEXTURE0)
  fbo = initializeDepthFbo (depthTextureUnit)
  depthProgram = initializeDepthProgram()
  getTextFromWorld()

  //SHADOW
  const noise = await readImage('./noise.png')
  const terrainNoiseElevations = imageToGrayscale(noise)
  const terrain = new Terrain(terrainNoiseElevations, noise.width, noise.height)
  const terrainTrimesh = terrain.toTrimesh()
  terrainTrimesh.generateNormals()

  const positions = terrainTrimesh.flat_positions()
  const normals = terrainTrimesh.flat_normals()
  const indices = terrainTrimesh.flat_indices()

  console.log("normals:", normals)

  attributes = new VertexAttributes()
  attributes.addAttribute('position', positions.length / 3, 3, positions)
  attributes.addAttribute('normal', normals.length / 3, 3, normals)
  attributes.addIndices(indices)

  const from = new Vector3(terrain.width/2, .3, terrain.depth/2)
  const to = new Vector3(0, 0, 0)
  const worldup = new Vector3(0, 1, 0)
  camera = new TerrianCamera (from, to, worldup, terrain, .2)
  
  const vertexSource = `
uniform mat4 clipFromEye;
uniform mat4 eyeFromWorld;
uniform mat4 worldFromModel;
uniform mat4 textureFromWorld;

in vec3 normal;
in vec3 position;

out vec3 mixNormal;
out vec3 mixPosition;
out vec4 mixTexPosition;

void main() {
  gl_PointSize = 3.0;
  gl_Position = clipFromEye * eyeFromWorld * worldFromModel * vec4(position, 1.0);
  mixNormal = (eyeFromWorld * worldFromModel * vec4(normal.x, -normal.y, normal.z, 0)).xyz;
  mixPosition =  (eyeFromWorld * worldFromModel * vec4(position, 1.0)).xyz;
  mixTexPosition = textureFromWorld * worldFromModel * vec4(position, 1.0);
}
  `;

  const fragmentSource = `
const vec3 lightDirection = normalize(vec3(1.0, 1.0, 3.0));
uniform vec3 albedo;
uniform vec3 diffuseColor;
uniform vec3 specularColor;
uniform float shininess;
uniform float ambientFactor;

uniform sampler2D depthTexture;

in vec3 mixNormal;
in vec3 mixPosition;
in vec4 mixTexPosition;

out vec4 fragmentColor;

void main() {
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
  fragmentColor = vec4(rgb, 1.0);
  // fragmentColor = vec4(vec3(litness), 1.0);
}
  `;

  shaderProgram = new ShaderProgram(vertexSource, fragmentSource)
  vao = new VertexArray(shaderProgram, attributes)

  await initializeObjects(shaderProgram)

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

}

async function initializeObjects(shaderProgram) {
  const names = ['./Andross.obj', './starfox_ship.obj']

  let lines = await readOBJFile('./Andross.obj')
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
  objects.push(trivao)
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
