import {VertexAttributes} from './vertex-attributes';
import {ShaderProgram} from './shader-program';
import {VertexArray} from './vertex-array';

let canvas;
let attributes;
let shaderProgram;
let vao;

let num = 10;

let degrees = 1;
let scale = 10;
let offsets;
let doInstance = true;

function render() {
  if (!doInstance) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 0.5, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  shaderProgram.bind();
  vao.bind();
  degrees = degrees * Math.PI / 180;
  shaderProgram.setUniform1f('radians', degrees);
  // for (let i = 0; i < num; i++) {
  for (let i = 0; i < offsets.length; i+=2) {
    shaderProgram.setUniform2f('offset', offsets[i], offsets[i+1])
    vao.drawIndexed(gl.TRIANGLES);  
  }
  vao.unbind();
  shaderProgram.unbind();
  }
  else {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1, 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    shaderProgram.bind();
    vao.bind();
    
    //vao.setAttributeDivisor (1,2)
    vao.setAttributeDivisor(1, 1);
    degrees = degrees * Math.PI / 180;
    shaderProgram.setUniform1f('radians', degrees);
    vao.drawIndexedInstanced(gl.TRIANGLES, num);
    vao.unbind();
    shaderProgram.unbind();
  }
}

function onResizeWindow() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  render();
}


async function initialize() {
  
  if (doInstance)
    initInstance()
  else 
    initNoInstance()
}

async function initNoInstance () {
  canvas = document.getElementById('canvas');
  window.gl = canvas.getContext('webgl2');

  const positions = [
    0, 0, 0,
    1/scale, 0, 0,
    1/scale, 1/scale, 0,
  ];

  const indices = [
    0, 1, 2,
  ]

  offsets = []
  for (let i = 0; i < num; i++) {
    const ran_x = Math.random()*2 - 1
    const ran_y = Math.random()*2 - 1
    offsets.push(ran_x, ran_y)
  }

  attributes = new VertexAttributes();
  attributes.addAttribute('position', positions.length / 3, 3, positions);
  attributes.addIndices(indices)

  const vertexSource = `
uniform float radians;
in vec3 position;
uniform vec2 offset;

out vec3 mixColor;

void main() {
  gl_PointSize = 10.0;
  gl_Position = vec4(
    position.x * cos(radians) - position.y * sin(radians) + offset.x,
    position.x * sin(radians) + position.y * cos(radians) + offset.y,
    position.z, 1.0);
    
    mixColor = vec3(position.x + offset.x, 
    position.y + offset.y, sin(offset.x));
}
  `;

  const fragmentSource = `
out vec4 fragmentColor;

in vec3 mixColor;

void main() {
  fragmentColor = vec4(mixColor, 1.0);
}
  `;

  shaderProgram = new ShaderProgram(vertexSource, fragmentSource);
  vao = new VertexArray(shaderProgram, attributes);

  // Event listeners
  window.addEventListener('resize', onResizeWindow);
  onResizeWindow();
  animateFrame()
}
async function initInstance () {
  canvas = document.getElementById('canvas');
  window.gl = canvas.getContext('webgl2');

  const positions = [
    0, 0, 0,
    1/scale, 0, 0,
    1/scale, 1/scale, 0,
  ];

  const indices = [
    0, 1, 2,
  ]

  const offsets = []
  for (let i = 0; i < num; i++) {
    const ran_x = Math.random()*2 - 1
    const ran_y = Math.random()*2 - 1
    offsets.push(ran_x, ran_y)
  }

  attributes = new VertexAttributes();
  attributes.addAttribute('position', positions.length / 3, 3, positions);
  attributes.addAttribute('offset', positions.length / 3, 2, offsets)
  attributes.addIndices(indices)

  const vertexSource = `
uniform float radians;
in vec3 position;
in vec2 offset;

out vec3 mixColor;

void main() {
  gl_PointSize = 10.0;
  gl_Position = vec4(
    position.x * cos(radians) - position.y * sin(radians) + offset.x,
    position.x * sin(radians) + position.y * cos(radians) + offset.y,
    position.z, 1.0);
    
    mixColor = vec3(position.x + offset.x, 
    position.y + offset.y, sin(offset.x));
}
  `;

  const fragmentSource = `
out vec4 fragmentColor;

in vec3 mixColor;

void main() {
  fragmentColor = vec4(mixColor, 1.0);
}
  `;

  shaderProgram = new ShaderProgram(vertexSource, fragmentSource);
  vao = new VertexArray(shaderProgram, attributes);

  // Event listeners
  window.addEventListener('resize', onResizeWindow);
  onResizeWindow();
  animateFrame()
}

function animateFrame() {
  degrees = performance.now() * 0.1;
  render();
  requestAnimationFrame(animateFrame);
}

// window.addEventListener('mousemove', onMouseMove);
window.addEventListener('load', initialize);