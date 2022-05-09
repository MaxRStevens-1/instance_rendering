import { Vector3 } from './vector'

export async function readOBJFile(file) {
  const fullFile = await fetch(file).then(response => response.text())
  const lines = fullFile.split('\n')
  return lines
}

export class Trimesh {
  constructor(positions, normals, indices, texPositions) {
    this.positions = positions
    this.normals = normals
    this.indices = indices
    this.texPositions = texPositions
    
    this.min = null
    this.max = null
    this.centroid = null
  }

  flat_positions() {
    return this.positions.flatMap((pos) => [pos.x, pos.y, pos.z])
  }

  flat_normals() {
    return this.normals.flatMap((normal) => [normal.x, normal.y, normal.z])
  }

  flat_indices() {
    return this.indices.flatMap((index) => [index.x, index.y, index.z])
  }

  flat_tex() {
    return this.texPositions.flatMap((texPos) => [texPos.x, texPos.y])
  }

  static flat_to_vec(flat_array) {
    const vec_array = []
    for (let i = 0; i < flat_array.length; i += 3) {
      let vec = new Vector3(flat_array[i], flat_array[i+1], flat_array[i+2])
      vec_array.push(vec)
    }
    return vec_array
  }

  generateNormals() {
    this.normals = this.positions.map((x) => {
      return new Vector3(0, 0, 0)
    })
    this.indices.forEach((face) => {
      const positionA = this.positions[face.x]
      const positionB = this.positions[face.y]
      const positionC = this.positions[face.z]

      const vec_AB = positionB.sub(positionA)
      const vec_AC = positionC.sub(positionA)

      let normal = vec_AB.cross(vec_AC).normalize()

      this.normals[face.x] = this.normals[face.x].add(normal)
      this.normals[face.y] = this.normals[face.y].add(normal)
      this.normals[face.z] = this.normals[face.z].add(normal)

    })

    this.normals = this.normals.map((normal) => {
      let new_n = normal.normalize()
      return new_n;
    })
    return this.normals
  }

  static from_OBJ(lines) {
    const tmpPositions = []
    const tmpNormals = []
    const tmpIndices = []
    const textCoords = []
  
    // parse lines of OBJ and append to tmp lists
    for (let line of lines) 
    {
      let tokens = line.split(' ')
      if (tokens[0] == 'v') {
        // append to tmpPositions
        let x = Number(tokens[1])
        let y = Number(tokens[2])
        let z = Number(tokens[3])
        tmpPositions.push(new Vector3(x, y, z))
      }
      else if (tokens[0] == 'vn') {
        // append to tmpNormals
        let x = Number(tokens[1])
        let y = Number(tokens[2])
        let z = Number(tokens[3])
        tmpNormals.push(new Vector3(x, y, z))
      }
      else if (tokens[0] == 'f') {
        // append to indices
        for (let i = 2; i < tokens.length - 1; i++) {
          if (tokens[i+1] != "\r")
            tmpIndices.push([tokens[1], tokens[i], tokens[i+1]])
        }
      }
    }
  
    // build real arrays 
    let trimesh
    let {positions, normals, indices} = 
          this.buildArrays(tmpPositions, tmpNormals, tmpIndices);    

    trimesh = new Trimesh(positions, normals, indices, textCoords)
    if (normals.length == 0) {
      trimesh.generateNormals()
    }
    
    return trimesh;
  }

  static buildArrays(tmpPositions, tmpNormals, tmpIndices) {
    const positions = []
    const normals = []
    const indices = []
    const slashTokenToIndex = {}

    let hasNormals = true
    if (tmpNormals.length == 0) {
      hasNormals = false
    }
    
    for (let triangle of tmpIndices) 
    {
      let indexArray = []
      for (let slashToken of triangle)
      {
        // create new vertex if combo hasn't been seen before
        if (!(slashToken in slashTokenToIndex)) {
          slashTokenToIndex[slashToken] = positions.length
  
          // spilt slashtoken and read in position and normal indices
          let slashIndices = slashToken.split('//');
          let positionIndex = Number(slashIndices[0]) - 1;
          let position = tmpPositions[positionIndex];
          positions.push(position);

          if (hasNormals) {
            let normalIndex = Number(slashIndices[1]) - 1;
            let normal = tmpNormals[normalIndex];
            normals.push(normal)
          }
        }
        // look up slashtoken and append to indices
        let index = slashTokenToIndex[slashToken];
        indexArray.push(index);
      }
      indices.push(new Vector3(indexArray[0], indexArray[1], indexArray[2]))
    }
    return {positions, normals, indices}
  }

  bounding_box() {
    const min = new Vector3(this.positions[0].x, this.positions[0].y,this.positions[0].z)
    const max = new Vector3(this.positions[0].x, this.positions[0].y,this.positions[0].z) 

    for (let pos of this.positions)
    {
      // update x
      if (pos.x < min.x) {
        min.x = pos.x
      }
      else if (pos.x > max.x) {
        max.x = pos.x 
      }
      // update y
      if (pos.y < min.y) {
        min.y = pos.y 
      }
      else if (pos.y > max.y) {
        max.y = pos.y 
      }
      // update z
      if (pos.z < min.z) {
        min.z = pos.z
      }
      else if (pos.z > max.z) {
        max.z = pos.z
      }
    }

    this.min = min
    this.max = max

    return {min, max}
  }

  calculate_centroid() {
    this.centroid = (this.min.add(this.max)).scalarMultiply(0.5)
    return this.centroid
  }
}
export class TrimeshVao extends Trimesh {
  constructor(positions, normals, indices, vao, texPositions) {
    super (positions, normals, indices, texPositions)
    this.vao = vao
  }
}