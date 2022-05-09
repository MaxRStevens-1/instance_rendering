import {VertexAttributes} from './vertex-attributes';
import {ShaderProgram} from './shader-program';
import {VertexArray} from './vertex-array';

let canvas;
let attributes;
let shaderProgram;
let vao;

let degrees = 1;

function render() {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1, 0.5, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  shaderProgram.bind();
  vao.bind();
  degrees = degrees * Math.PI / 180;
  shaderProgram.setUniform1f('radians', degrees);
  vao.drawSequence(gl.TRIANGLES);
  vao.unbind();
  shaderProgram.unbind();
}

function onResizeWindow() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  render();
}

async function initialize() {
  canvas = document.getElementById('canvas');
  window.gl = canvas.getContext('webgl2');

  const positions = [
    0, 0, 0,
    0.5, 0, 0,
    0.5, 0.5, 0,
  ];

  attributes = new VertexAttributes();
  attributes.addAttribute('position', 3, 3, positions);

  const vertexSource = `
uniform float radians;
in vec3 position;

void main() {
  gl_PointSize = 10.0;
  gl_Position = vec4(
    position.x * cos(radians) - position.y * sin(radians),
    position.x * sin(radians) + position.y * cos(radians),
    position.z,
    1.0
  );
}
  `;

  const fragmentSource = `
out vec4 fragmentColor;
uniform vec3 color;

void main() {
  fragmentColor = vec4(color, 1.0);
}
  `;

  shaderProgram = new ShaderProgram(vertexSource, fragmentSource);
  vao = new VertexArray(shaderProgram, attributes);

  // Event listeners
  window.addEventListener('resize', onResizeWindow);
  onResizeWindow();

  // animateFrame();
  
}

// function animateFrame() {
//   degrees = performance.now() * 0.1;
//   render();
//   requestAnimationFrame(animateFrame);
// }

function setColor(r, g, b) {
  shaderProgram.bind();
  shaderProgram.setUniform3f('color', r, g, b);
  shaderProgram.unbind();
  render();
}

function onMouseMove(event) {
  degrees = event.clientX;
  render();
}

window.setColor = setColor;

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('load', initialize);