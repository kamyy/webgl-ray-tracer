export default class MTLFile {

  constructor(fileContents) {
    this._reset();
    this.fileContents = fileContents;
  }

  _reset() {
    this.materials = [];
    this.currentMaterial = null;
    this.lineNumber = 1;
    this.filename = '';
  }

  parse(defaultMaterialName = 'default') {
    this._reset();

    this.defaultMaterialName = defaultMaterialName;

    const lines = this.fileContents.split("\n");

    lines.forEach((line, index) => {

      this.lineNumber = (index + 1);

      const lineItems = MTLFile._stripComments(line).replace(/\s\s+/g, ' ').trim().split(' ');

      if (lineItems.length === 0 || !lineItems[0]) {
        return; // Skip blank lines
      }

      switch(lineItems[0].toLowerCase())
      {
        case 'newmtl':  // Starts a new material, assigns a name to it
          this._parseNewMTL(lineItems);
          break;

        case 'illum': // Specifies which Illumination model is to be used when rendering the current material. (eg. illum 2)
          // Abbreviations:
          //  N    Unit surface normal
          //  Ia   Itensity of the ambient light
          //  ls   # of lights
          //  Lj   Light direction (vector) of light j
          //  Ij   Light intensity (scalar) of light j

          // Illumination ModeLs:
          //  0:  Constant color   (color = Kd)

          //  1:  Diffuse illumination model (using Lambertian shading).
          //        color = KaIa + Kd { SUM j=1..ls, (N * Lj)Ij }

          //  2:  Diffuse and specular illumination model using Lambertian shading,
          //      and Blinn's interpretation of Phong's specular illumination model.

          //        color = KaIa
          //          + Kd { SUM j=1..ls, (N*Lj)Ij }
          //          + Ks { SUM j=1..ls, ((H*Hj)^Ns)Ij }
          this._parseIllum(lineItems);
          break;
        case 'ka': // (Ka) - Ambient color of material
          this._parseKa(lineItems);
          break;
        case 'kd': // (Kd) - Difffuse reflectance
          this._parseKd(lineItems);
          break;
        case 'ks': // (Ks) - Specular reflectance
          this._parseKs(lineItems);
          break;
        case 'ke': // (Kd) - Emissive color
          this._parseKe(lineItems);
          break;

        case 'tf': // Transmission filter
          this._parseTF(lineItems);
          break;
        case 'ns': // (Ns) - Specular Exponent
          this._parseNs(lineItems);
          break;
        case 'ni': // (Ni) -
          this._parseNi(lineItems);
          break;
        case 'd': // Controls how the current material dissolves (becomes transparent)
          this._parseD(lineItems);
          break;
        case 'tr': // Controls how transparent the current material is (inverted: Tr = 1 - d)
          this._parseTr(lineItems);
          break;
        case 'sharpness':
          this._parseSharpness(lineItems);
          break;

        case 'map_ka': //
          this._parseMapKa(lineItems);
          break;
        case 'map_kd': //
          this._parseMapKd(lineItems);
          break;
        case 'map_ks':
          this._parseMapKs(lineItems);
          break;
        case 'map_ns':
          this._parseMapNs(lineItems);
          break;
        case 'map_d':
          this._parseMapD(lineItems);
          break;

        case 'disp':
          this._parseDisp(lineItems);
          break;
        case 'decal':
          this._parseDecal(lineItems);
          break;
        case 'bump':
          this._parseBump(lineItems);
          break;

        case 'refl': // Reflection Map Statement
          this._parseRefl(lineItems);
          break;

        default:
          this._fileError(`Unrecognized statement: ${lineItems[0]}`);
      }
    });

    return this.materials;
  }

  static _stripComments(lineString) {
    let commentIndex = lineString.indexOf('#');
    if(commentIndex > -1)
      return lineString.substring(0, commentIndex);
    else
      return lineString;
  }

  _createMaterial(name) {
    const newMaterial = {
      name: name,
      illum: 0,
      Ka: {
        method: 'rgb',
        red: 0,
        green: 0,
        blue: 0
      },
      Kd: {
        method: 'rgb',
        red: 0,
        green: 0,
        blue: 0
      },
      Ks: {
        method: 'ks',
        red: 0,
        green: 0,
        blue: 0
      },
      Ke: {
        method: 'rgb',
        red: 0,
        green: 0,
        blue: 0
      },
      map_Ka: {
        file: null
      },
      map_Kd: {
        file: null
      },
      map_Ks: {
        file: null
      },
      map_d: {
        file: null
      },
      dissolve: 1.0,
    };
    this.materials.push(newMaterial);
  }
  _getCurrentMaterial() {
    if (this.materials.length === 0) {
      this._createMaterial(this.defaultMaterialName);
    }
    return this.materials[this.materials.length - 1];
  }

  // newmtl material_name
  _parseNewMTL(lineItems) {
    if (lineItems.length < 2) {
      throw new Error('newmtl statement must specify a name for the maerial (eg, newmtl brickwall)');
    }
    this._createMaterial(lineItems[1]);
  }

  _parseIllum(lineItems) {
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: illum <number>');
    }
    this._getCurrentMaterial().illum = parseInt(lineItems[1]);
  }

  // Ka r g b         <- currently only this syntax is supported
  // Ka spectral file.rfl factor
  // Ka xyz x y z
  _parseKa(lineItems) {
    if (lineItems.length !== 4) {
      this._notImplemented('Ka statements must have exactly 3 arguments (only Ka R G B syntax is supported');
      return;
    }
    const Ka = this._getCurrentMaterial().Ka;
    const color = this._parseKStatementRGB(lineItems);
    Ka.red = color.red;
    Ka.green = color.green;
    Ka.blue = color.blue;
  }

  // Kd r g b         <- currently only this syntax is supported
  // Kd spectral file.rfl factor
  // Kd xyz x y z
  _parseKd(lineItems) {
    if (lineItems.length !== 4) {
      this._notImplemented('Kd statements must have exactly 3 arguments (only Kd R G B syntax is supported');
      return;
    }
    const Kd = this._getCurrentMaterial().Kd;
    const color = this._parseKStatementRGB(lineItems);
    Kd.red = color.red;
    Kd.green = color.green;
    Kd.blue = color.blue;
  }

  // Ks r g b
  // Ks spectral file.rfl factor
  // Ks xyz x y z
  _parseKs(lineItems) {
    if (lineItems.length !== 4) {
      this._notImplemented('Ks statements must have exactly 3 arguments (only Ks R G B syntax is supported');
      return;
    }
    const Ks = this._getCurrentMaterial().Ks;
    const color = this._parseKStatementRGB(lineItems);
    Ks.red = color.red;
    Ks.green = color.green;
    Ks.blue = color.blue;
  }

  // Ke r g b         <- currently only this syntax is supported
  // Ke spectral file.rfl factor
  // Ke xyz x y z
  _parseKe(lineItems) {
    if (lineItems.length !== 4) {
      this._notImplemented('Ke statements must have exactly 3 arguments (only Ke R G B syntax is supported');
      return;
    }
    const Ke = this._getCurrentMaterial().Ke;
    const color = this._parseKStatementRGB(lineItems);
    Ke.red = color.red;
    Ke.green = color.green;
    Ke.blue = color.blue;
  }

  // extracts the rgb values from a "Ka/Kd/Ks/Ke r g b" statement
  _parseKStatementRGB(lineItems) {
    if (lineItems.length < 4) {
      this._fileError('to few arguments, expected: Ka/Kd/Ks keyword followed by: r g b values');
    }
    if (lineItems[1].toLowerCase() === 'spectral') {
      this._notImplemented('Ka spectral <filename> <factor>');
      return;
    } else if (lineItems[1].toLowerCase() === 'xyz') {
      this._notImplemented('Ka xyz <x> <y> <z>');
      return;
    }

    return {
      red: parseFloat(lineItems[1]),
      green: parseFloat(lineItems[2]),
      blue: parseFloat(lineItems[3])
    };
  }

  _parseTF(lineItems) {
    this._notImplemented('tf');
  }

  // ns 500
  // Defines how focused the specular highlight is,
  // typically in the range of 0 to 1000.
  _parseNs(lineItems) {
    this._notImplemented('Ns');
  }

  _parseNi(lineItems) {
    this._notImplemented('Ni');
  }

  // d factor
  // Controls how much the current material dissolves (becomes transparent).
  // Materials can be transparent. This is referred to as being dissolved.
  // Unlike real transparency, the result does not depend upon the thickness of the object.
  // A value of 1.0 for "d" is the default and means fully opaque, as does a value of 0.0 for "Tr".
  _parseD(lineItems) {
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: d <factor>');
    }
    this._getCurrentMaterial().dissolve = parseFloat(lineItems[1]);
  }

  // Tr factor
  // Controls how transparent the current material is (inverted: Tr = 1 - d).
  // Materials can be transparent. This is referred to as being dissolved.
  // Unlike real transparency, the result does not depend upon the thickness of the object.
  // A value of 1.0 for "d" is the default and means fully opaque, as does a value of 0.0 for "Tr".
  _parseTr(lineItems) {
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: Tr <factor>');
    }
    this._getCurrentMaterial().dissolve = 1.0 - parseFloat(lineItems[1]);
  }

  _parseSharpness(lineItems) {
    this._notImplemented('sharpness');
  }

  // map_Ka [options] textureFile
  // map_Ka -s 1 1 1 -o 0 0 0 -mm 0 1 file.mpc
  _parseMapKa(lineItems) {
    // TODO parse options (lineItems[1] to lineItems[lineItems.length - 2])
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: map_ka <textureImageFile>');
    }
    const file = lineItems[lineItems.length - 1];
    this._getCurrentMaterial().map_Ka.file = file;
  }

  // map_Kd [options] textureFile
  _parseMapKd(lineItems) {
    // TODO parse options (lineItems[1] to lineItems[lineItems.length - 2])
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: map_Kd <textureImageFile>');
    }
    const file = lineItems[lineItems.length - 1];
    this._getCurrentMaterial().map_Kd.file = file;
  }

  // map_d [options] textureFile
  _parseMapD(lineItems) {
    // TODO parse options (lineItems[1] to lineItems[lineItems.length - 2])
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: map_d <textureImageFile>');
    }
    const file = lineItems[lineItems.length - 1];
    this._getCurrentMaterial().map_d.file = file;
  }

  // map_Ks [options] textureFile
  _parseMapKs(lineItems) {
    // TODO parse options (lineItems[1] to lineItems[lineItems.length - 2])
    if (lineItems.length < 2) {
      this._fileError('to few arguments, expected: map_Ks <textureImageFile>');
    } else if (lineItems.length > 2) {

    }
    const file = lineItems[lineItems.length - 1];
    this._getCurrentMaterial().map_Ks.file = file;
  }

  _parseMapNs(lineItems) {
    this._notImplemented('map_Ns');
  }

  _parseDisp(lineItems) {
    this._notImplemented('disp');
  }

  _parseDecal(lineItems) {
    this._notImplemented('decal');
  }

  _parseBump(lineItems) {
    this._notImplemented('bump');
  }

  _parseRefl(lineItems) {
    this._notImplemented('bump');
  }

  _notImplemented(message) {
    console.warn(`MTL file statement not implemented: ${message}`);
  }

  _fileError(message) {
    const material = `Material: ${this._getCurrentMaterial().name}`;
    const line = `Line: ${this.lineNumber}`;
    const errorMessage = `MTL file format error (${line}  ${material}): ${message}`;
    throw errorMessage;
  }

}
