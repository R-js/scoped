const gpuFunctionExported = () => {
  function kernelRunShortcut(kernel) {
    var shortcut = function shortcut() {
      return kernel.run.apply(kernel, arguments);
    };

    utils.allPropertiesOf(kernel).forEach(function (key) {
      if (key[0] === '_' && key[1] === '_') return;
      if (typeof kernel[key] === 'function') {
        if (key.substring(0, 3) === 'add' || key.substring(0, 3) === 'set') {
          shortcut[key] = function () {
            kernel[key].apply(kernel, arguments);
            return shortcut;
          };
        } else {
          shortcut[key] = kernel[key].bind(kernel);
        }
      } else {
        shortcut.__defineGetter__(key, function () {
          return kernel[key];
        });
        shortcut.__defineSetter__(key, function (value) {
          kernel[key] = value;
        });
      }
    });

    shortcut.kernel = kernel;

    return shortcut;
  };
  const utils = {
    allPropertiesOf: function allPropertiesOf(obj) {
      var props = [];

      do {
        props.push.apply(props, Object.getOwnPropertyNames(obj));
      } while (obj = Object.getPrototypeOf(obj));

      return props;
    },
    clone: function clone(obj) {
      if (obj === null || (typeof obj === 'undefined' ? 'undefined' : typeof(obj)) !== 'object' || obj.hasOwnProperty('isActiveClone')) return obj;

      var temp = obj.constructor();

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj.isActiveClone = null;
          temp[key] = Utils.clone(obj[key]);
          delete obj.isActiveClone;
        }
      }

      return temp;
    },
    splitArray: function splitArray(array, part) {
      var result = [];
      for (var i = 0; i < array.length; i += part) {
        result.push(new array.constructor(array.buffer, i * 4 + array.byteOffset, part));
      }
      return result;
    },
    getArgumentType: function getArgumentType(arg) {
      if (Utils.isArray(arg)) {
        if (arg[0].nodeName === 'IMG') {
          return 'HTMLImageArray';
        }
        return 'Array';
      } else if (typeof arg === 'number') {
        if (Number.isInteger(arg)) {
          return 'Integer';
        }
        return 'Float';
      } else if (arg instanceof Texture) {
        if (arg.type === 'vec4') {
          return 'TextureVec4';
        } else {
          return 'Texture';
        }
      } else if (arg instanceof Input) {
        return 'Input';
      } else if (arg.nodeName === 'IMG') {
        return 'HTMLImage';
      } else {
        return 'Unknown';
      }
    },
    getDimensions: function getDimensions(x, pad) {
      var ret = void 0;
      if (Utils.isArray(x)) {
        var dim = [];
        var temp = x;
        while (Utils.isArray(temp)) {
          dim.push(temp.length);
          temp = temp[0];
        }
        ret = dim.reverse();
      } else if (x instanceof Texture) {
        ret = x.output;
      } else if (x instanceof Input) {
        ret = x.size;
      } else {
        throw 'Unknown dimensions of ' + x;
      }

      if (pad) {
        ret = Utils.clone(ret);
        while (ret.length < 3) {
          ret.push(1);
        }
      }
      return new Int32Array(ret);
    },
    dimToTexSize: function dimToTexSize(opt, dimensions, output) {
      var numTexels = dimensions[0];
      var w = dimensions[0];
      var h = dimensions[1];
      for (var i = 1; i < dimensions.length; i++) {
        numTexels *= dimensions[i];
      }

      if (opt.floatTextures && (!output || opt.floatOutput)) {
        w = numTexels = Math.ceil(numTexels / 4);
      }
      if (h > 1 && w * h === numTexels) {
        return [w, h];
      }
      var sqrt = Math.sqrt(numTexels);
      var high = Math.ceil(sqrt);
      var low = Math.floor(sqrt);
      while (high * low > numTexels) {
        high--;
        low = Math.ceil(numTexels / high);
      }
      w = low;
      h = Math.ceil(numTexels / w);
      return [w, h];
    },
    flattenTo: function flattenTo(array, target) {
      if (Utils.isArray(array[0])) {
        if (Utils.isArray(array[0][0])) {
          Utils.flatten3dArrayTo(array, target);
        } else {
          Utils.flatten2dArrayTo(array, target);
        }
      } else {
        target.set(array);
      }
    },
    flatten2dArrayTo: function flatten2dArrayTo(array, target) {
      var offset = 0;
      for (var y = 0; y < array.length; y++) {
        target.set(array[y], offset);
        offset += array[y].length;
      }
    },
    flatten3dArrayTo: function flatten3dArrayTo(array, target) {
      var offset = 0;
      for (var z = 0; z < array.length; z++) {
        for (var y = 0; y < array[z].length; y++) {
          target.set(array[z][y], offset);
          offset += array[z][y].length;
        }
      }
    },
    systemEndianness: 'LE',
    initWebGl: function initWebGl(canvasObj) {

      if (typeof _isCanvasSupported !== 'undefined' || canvasObj === null) {
        if (!_isCanvasSupported) {
          return null;
        }
      }

      if (!UtilsCore.isCanvas(canvasObj)) {
        throw new Error('Invalid canvas object - ' + canvasObj);
      }

      var webGl = canvasObj.getContext('experimental-webgl', UtilsCore.initWebGlDefaultOptions()) || canvasObj.getContext('webgl', UtilsCore.initWebGlDefaultOptions());

      if (webGl) {
        webGl.OES_texture_float = webGl.getExtension('OES_texture_float');
        webGl.OES_texture_float_linear = webGl.getExtension('OES_texture_float_linear');
        webGl.OES_element_index_uint = webGl.getExtension('OES_element_index_uint');
      }

      return webGl;
    },
    isArray: function isArray(array) {
      if (isNaN(array.length)) {
        return false;
      }

      return true;
    },
    checkOutput: function checkOutput(output) {
      for (var i = 0; i < output.length; i++) {
        if (isNaN(output[i]) || output[i] < 1) {
          throw new Error('kernel.output[' + i + '] incorrectly defined as `' + output[i] + '`, needs to be numeric, and greater than 0');
        }
      }
    }
  };
  function Input(value, size) {

    this.value = value;
    if (Array.isArray(size)) {
      this.size = [];
      for (var i = 0; i < size.length; i++) {
        this.size[i] = size[i];
      }
      while (this.size.length < 3) {
        this.size.push(1);
      }
    } else {
      if (size.z) {
        this.size = [size.x, size.y, size.z];
      } else if (size.y) {
        this.size = [size.x, size.y, 1];
      } else {
        this.size = [size.x, 1, 1];
      }
    }
  }
  function Texture(texture, size, dimensions, output, webGl) {
    var type = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 'float';


    this.texture = texture;
    this.size = size;
    this.dimensions = dimensions;
    this.output = output;
    this.webGl = webGl;
    this.kernel = null;
    this.type = type;
  }
  const Utils = utils;
  const canvases = [];
  const maxTexSizes = {};
  class Kernel {
    constructor() {
      this.maxTexSize = null;
      this.argumentsLength = 0;
      this.constantsLength = 0;
      this._canvas = null;
      this._webGl = null;
      this.built = false;
      this.program = null;
      this.paramNames = ["a","b","c","lda","ldb","ldc","m","n","k","alpha","beta"];
      this.paramTypes = ["Array","Array","Array","Integer","Integer","Integer","Integer","Integer","Integer","Float","Float"];
      this.texSize = [4,6];
      this.output = [4,6];
      this.compiledFragShaderString = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

const float LOOP_MAX = 1000.0;

uniform ivec3 uOutputDim;
uniform ivec2 uTexSize;

in vec2 vTexCoord;

vec2 integerMod(vec2 x, float y) {
  vec2 res = floor(mod(x, y));
  return res * step(1.0 - floor(y), -res);
}

vec3 integerMod(vec3 x, float y) {
  vec3 res = floor(mod(x, y));
  return res * step(1.0 - floor(y), -res);
}

vec4 integerMod(vec4 x, vec4 y) {
  vec4 res = floor(mod(x, y));
  return res * step(1.0 - floor(y), -res);
}

float integerMod(float x, float y) {
  float res = floor(mod(x, y));
  return res * (res > floor(y) - 1.0 ? 0.0 : 1.0);
}

int integerMod(int x, int y) {
  return x - (y * int(x/y));
}


			  float div_with_int_check(float x, float y) {
			  if (floor(x) == x && floor(y) == y && integerMod(x, y) == 0.0) {
			    return float(int(x)/int(y));
			  }
			  return x / y;
			}

// Here be dragons!
// DO NOT OPTIMIZE THIS CODE
// YOU WILL BREAK SOMETHING ON SOMEBODY'S MACHINE
// LEAVE IT AS IT IS, LEST YOU WASTE YOUR OWN TIME
const vec2 MAGIC_VEC = vec2(1.0, -256.0);
const vec4 SCALE_FACTOR = vec4(1.0, 256.0, 65536.0, 0.0);
const vec4 SCALE_FACTOR_INV = vec4(1.0, 0.00390625, 0.0000152587890625, 0.0); // 1, 1/256, 1/65536
float decode32(vec4 rgba) {
  rgba *= 255.0;
  vec2 gte128;
  gte128.x = rgba.b >= 128.0 ? 1.0 : 0.0;
  gte128.y = rgba.a >= 128.0 ? 1.0 : 0.0;
  float exponent = 2.0 * rgba.a - 127.0 + dot(gte128, MAGIC_VEC);
  float res = exp2(round(exponent));
  rgba.b = rgba.b - 128.0 * gte128.x;
  res = dot(rgba, SCALE_FACTOR) * exp2(round(exponent-23.0)) + res;
  res *= gte128.y * -2.0 + 1.0;
  return res;
}

vec4 encode32(float f) {
  float F = abs(f);
  float sign = f < 0.0 ? 1.0 : 0.0;
  float exponent = floor(log2(F));
  float mantissa = (exp2(-exponent) * F);
  // exponent += floor(log2(mantissa));
  vec4 rgba = vec4(F * exp2(23.0-exponent)) * SCALE_FACTOR_INV;
  rgba.rg = integerMod(rgba.rg, 256.0);
  rgba.b = integerMod(rgba.b, 128.0);
  rgba.a = exponent*0.5 + 63.5;
  rgba.ba += vec2(integerMod(exponent+127.0, 2.0), sign) * 128.0;
  rgba = floor(rgba);
  rgba *= 0.003921569; // 1/255
  return rgba;
}
// Dragons end here

float decode(vec4 rgba, int x, int bitRatio) {
  if (bitRatio == 1) {
    return decode32(rgba);
  }
  int channel = integerMod(x, bitRatio);
  if (bitRatio == 4) {
    return rgba[channel] * 255.0;
  }
  else {
    return rgba[channel*2] * 255.0 + rgba[channel*2 + 1] * 65280.0;
  }
}

int index;
ivec3 threadId;

ivec3 indexTo3D(int idx, ivec3 texDim) {
  int z = int(idx / (texDim.x * texDim.y));
  idx -= z * int(texDim.x * texDim.y);
  int y = int(idx / texDim.x);
  int x = int(integerMod(idx, texDim.x));
  return ivec3(x, y, z);
}

float get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio,  int z, int y, int x) {
  ivec3 xyz = ivec3(x, y, z);
  int index = xyz.x + texDim.x * (xyz.y + texDim.y * xyz.z);
  int w = texSize.x;
  vec2 st = vec2(float(integerMod(index, w)), float(index / w)) + 0.5;
  vec4 texel = texture(tex, st / vec2(texSize));
  return decode(texel, x, bitRatio);
}

vec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int z, int y, int x) {
  ivec3 xyz = ivec3(x, y, z);
  int index = xyz.x + texDim.x * (xyz.y + texDim.y * xyz.z);
  int w = texSize.x;
  vec2 st = vec2(float(integerMod(index, w)), float(index / w)) + 0.5;
  return texture(tex, st / vec2(texSize));
}

vec4 getImage3D(sampler2DArray tex, ivec2 texSize, ivec3 texDim, int z, int y, int x) {
  ivec3 xyz = ivec3(x, y, z);
  int index = xyz.x + texDim.x * (xyz.y + texDim.y * xyz.z);
  int w = texSize.x;
  vec2 st = vec2(float(integerMod(index, w)), float(index / w)) + 0.5;
  return texture(tex, vec3(st / vec2(texSize), z));
}

float get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio, int y, int x) {
  return get(tex, texSize, texDim, bitRatio, 0, y, x);
}

float get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio, int x) {
  return get(tex, texSize, texDim, bitRatio, 0, 0, x);
}

vec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int y, int x) {
  return getImage2D(tex, texSize, texDim, 0, y, x);
}

vec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int x) {
  return getImage2D(tex, texSize, texDim, 0, 0, x);
}

vec4 actualColor;
void color(float r, float g, float b, float a) {
  actualColor = vec4(r,g,b,a);
}

void color(float r, float g, float b) {
  color(r,g,b,1.0);
}

uniform highp sampler2D user_a;
uniform highp ivec2 user_aSize;
uniform highp ivec3 user_aDim;
uniform highp int user_aBitRatio;
uniform highp sampler2D user_b;
uniform highp ivec2 user_bSize;
uniform highp ivec3 user_bDim;
uniform highp int user_bBitRatio;
uniform highp sampler2D user_c;
uniform highp ivec2 user_cSize;
uniform highp ivec3 user_cDim;
uniform highp int user_cBitRatio;
uniform float user_lda;
uniform float user_ldb;
uniform float user_ldc;
uniform float user_m;
uniform float user_n;
uniform float user_k;
uniform float user_alpha;
uniform float user_beta;

out vec4 data0;
float kernelResult = 0.0;
void kernel() {
float user_cIndex=((user_ldc*float(threadId.y))+float(threadId.x));
float user_sum=(get(user_c, ivec2(user_cSize[0],user_cSize[1]), ivec3(user_cDim[0],user_cDim[1],user_cDim[2]), user_cBitRatio, int(user_cIndex))*user_beta);
for (float user_i=0.0;user_i<LOOP_MAX;user_i++){
if (user_i<user_k) {
float user_aIndex=((user_lda*user_i)+float(threadId.x));float user_bIndex=((user_ldb*float(threadId.y))+user_i);user_sum+=((get(user_a, ivec2(user_aSize[0],user_aSize[1]), ivec3(user_aDim[0],user_aDim[1],user_aDim[2]), user_aBitRatio, int(user_aIndex))*user_alpha)*get(user_b, ivec2(user_bSize[0],user_bSize[1]), ivec3(user_bDim[0],user_bDim[1],user_bDim[2]), user_bBitRatio, int(user_bIndex)));
} else {
break;
}
}

kernelResult = user_sum;return;
}
void main(void) {
  index = int(vTexCoord.s * float(uTexSize.x)) + int(vTexCoord.t * float(uTexSize.y)) * uTexSize.x;
  threadId = indexTo3D(index, uOutputDim);
  kernel();
  data0 = encode32(kernelResult);
}`;
      this.compiledVertShaderString = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 aPos;
in vec2 aTexCoord;

out vec2 vTexCoord;
uniform vec2 ratio;

void main(void) {
  gl_Position = vec4((aPos + vec2(1)) * ratio + vec2(-1), 0, 1);
  vTexCoord = aTexCoord;
}`;
      this.programUniformLocationCache = {};
      this.textureCache = {};
      this.subKernelOutputTextures = null;
      this.subKernelOutputVariableNames = null;
      this.uniform1fCache = {};
      this.uniform1iCache = {};
      this.uniform2fCache = {};
      this.uniform2fvCache = {};
      this.uniform2ivCache = {};
      this.uniform3fvCache = {};
      this.uniform3ivCache = {};
    }
    _getFragShaderString(args) {
      if (this.compiledFragShaderString !== null) {
        return this.compiledFragShaderString;
      }
      return this.compiledFragShaderString = this._replaceArtifacts(this.constructor.fragShaderString, this._getFragShaderArtifactMap(args));
    }
    _getVertShaderString(args) {
      if (this.compiledVertShaderString !== null) {
        return this.compiledVertShaderString;
      }
      return this.compiledVertShaderString = this.constructor.vertShaderString;
    }
    validateOptions() {}
    setupParams() {}
    setupConstants() {}
    setCanvas(canvas) { this._canvas = canvas; return this; }
    setWebGl(webGl) { this._webGl = webGl; return this; }
    getUniformLocation(name) {
      if (this.programUniformLocationCache.hasOwnProperty(name)) {
        return this.programUniformLocationCache[name];
      }
      return this.programUniformLocationCache[name] = this._webGl.getUniformLocation(this.program, name);
    }
    setupParams(args) {
      this.paramTypes = [];
      this.paramSizes = [];
      for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        this.paramTypes.push(utils.getArgumentType(arg));
        this.paramSizes.push(arg.constructor === Input ? arg.size : null);
      }
    }
    setupConstants() {
      this.constantTypes = {};
      if (this.constants) {
        for (var p in this.constants) {
          this.constantTypes[p] = utils.getArgumentType(this.constants[p]);
        }
      }
    }
    build() {
      this.validateOptions();
      this.setupConstants();
      this.setupParams(arguments);
      this.updateMaxTexSize();
      var texSize = this.texSize;
      var gl = this._webGl;
      var canvas = this._canvas;
      gl.enable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, this.maxTexSize[0], this.maxTexSize[1]);
      canvas.width = this.maxTexSize[0];
      canvas.height = this.maxTexSize[1];
      var threadDim = this.threadDim = utils.clone(this.output);
      while (threadDim.length < 3) {
        threadDim.push(1);
      }

      if (this.functionBuilder) this._addKernels();

      var compiledVertShaderString = this._getVertShaderString(arguments);
      var vertShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertShader, compiledVertShaderString);
      gl.compileShader(vertShader);
      if (this.vertShader) {}
      this.vertShader = vertShader;

      var compiledFragShaderString = this._getFragShaderString(arguments);
      var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragShader, compiledFragShaderString);
      gl.compileShader(fragShader);
      this.fragShader = fragShader;

      if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
        console.log(compiledVertShaderString);
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(vertShader));
        throw new Error('Error compiling vertex shader');
      }
      if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
        console.log(compiledFragShaderString);
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(fragShader));
        throw new Error('Error compiling fragment shader');
      }

      if (this.debug) {
        console.log('Options:');
        console.dir(this);
        console.log('GLSL Shader Output:');
        console.log(compiledFragShaderString);
      }

      var program = this.program = gl.createProgram();
      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);
      this.framebuffer = gl.createFramebuffer();
      this.framebuffer.width = texSize[0];
      this.framebuffer.height = texSize[1];

      var vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
      var texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

      var texCoordOffset = vertices.byteLength;

      var buffer = this.buffer;
      if (!buffer) {
        buffer = this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength + texCoords.byteLength, gl.STATIC_DRAW);
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      }

      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);
      gl.bufferSubData(gl.ARRAY_BUFFER, texCoordOffset, texCoords);

      var aPosLoc = gl.getAttribLocation(this.program, 'aPos');
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, gl.FALSE, 0, 0);
      var aTexCoordLoc = gl.getAttribLocation(this.program, 'aTexCoord');
      gl.enableVertexAttribArray(aTexCoordLoc);
      gl.vertexAttribPointer(aTexCoordLoc, 2, gl.FLOAT, gl.FALSE, 0, texCoordOffset);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

      for (var p in this.constants) {
        var value = this.constants[p];
        var type = utils.getArgumentType(value);
        if (type === 'Decimal' || type === 'Integer') {
          continue;
        }
        gl.useProgram(this.program);
        this._addConstant(this.constants[p], type, p);
        this.constantsLength++;
      }

      if (!this.outputImmutable) {
        this._setupOutputTexture();
        if (this.subKernelOutputVariableNames !== null && this.subKernelOutputVariableNames.length > 0) {
          this._setupSubOutputTextures(this.subKernelOutputVariableNames.length);
        }
      }
    }
    run() {
      if (this.program === null) {
        this.build.apply(this, arguments);
      }
      var paramNames = this.paramNames;
      var paramTypes = this.paramTypes;
      var texSize = this.texSize;
      var gl = this._webGl;

      gl.useProgram(this.program);
      gl.scissor(0, 0, texSize[0], texSize[1]);

      if (!this.hardcodeConstants) {
        this.setUniform3iv('uOutputDim', new Int32Array(this.threadDim));
        this.setUniform2iv('uTexSize', texSize);
      }

      this.setUniform2f('ratio', texSize[0] / this.maxTexSize[0], texSize[1] / this.maxTexSize[1]);

      this.argumentsLength = 0;
      for (var texIndex = 0; texIndex < paramNames.length; texIndex++) {
        this._addArgument(arguments[texIndex], paramTypes[texIndex], paramNames[texIndex]);
      }

      if (this.graphical) {
        if (this.outputToTexture) {
          gl.bindRenderbuffer(gl.RENDERBUFFER, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
          if (!this.outputTexture || this.outputImmutable) {
            this._setupOutputTexture();
          }
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          return new Texture(this.outputTexture, texSize, this.threadDim, this.output, this._webGl, 'vec4');
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      if (this.outputImmutable) {
        this._setupOutputTexture();
      }
      var outputTexture = this.outputTexture;

      if (this.subKernelOutputVariableNames !== null) {
        if (this.outputImmutable) {
          this.subKernelOutputTextures = [];
          this._setupSubOutputTextures(this.subKernelOutputVariableNames.length);
        }
        gl.drawBuffers(this.drawBuffersMap);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (this.subKernelOutputTextures !== null) {
        if (this.subKernels !== null) {
          var output = [];
          output.result = this.renderOutput(outputTexture);
          for (var i = 0; i < this.subKernels.length; i++) {
            output.push(new Texture(this.subKernelOutputTextures[i], texSize, this.threadDim, this.output, this._webGl));
          }
          return output;
        } else if (this.subKernelProperties !== null) {
          var _output = {
            result: this.renderOutput(outputTexture)
          };
          var _i = 0;
          for (var p in this.subKernelProperties) {
            if (!this.subKernelProperties.hasOwnProperty(p)) continue;
            _output[p] = new Texture(this.subKernelOutputTextures[_i], texSize, this.threadDim, this.output, this._webGl);
            _i++;
          }
          return _output;
        }
      }

      return this.renderOutput(outputTexture);
    }
    _addArgument(value, type, name) {
      var gl = this._webGl;
      var argumentTexture = this.getArgumentTexture(name);
      if (value instanceof Texture) {
        type = 'Texture';
      }
      switch (type) {
        case 'Array':
        {
          var dim = utils.getDimensions(value, true);
          var size = utils.dimToTexSize({
            floatTextures: this.floatTextures,
            floatOutput: this.floatOutput
          }, dim);
          gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.argumentsLength);
          gl.bindTexture(gl.TEXTURE_2D, argumentTexture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

          var length = size[0] * size[1];

          var _formatArrayTransfer = this._formatArrayTransfer(value, length),
            valuesFlat = _formatArrayTransfer.valuesFlat,
            bitRatio = _formatArrayTransfer.bitRatio;

          var buffer = void 0;
          if (this.floatTextures) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size[0], size[1], 0, gl.RGBA, gl.FLOAT, valuesFlat);
          } else {
            buffer = new Uint8Array(valuesFlat.buffer);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size[0] / bitRatio, size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
          }

          if (!this.hardcodeConstants) {
            this.setUniform3iv('user_' + name + 'Dim', dim);
            this.setUniform2iv('user_' + name + 'Size', size);
          }
          this.setUniform1i('user_' + name + 'BitRatio', bitRatio);
          this.setUniform1i('user_' + name, this.argumentsLength);
          break;
        }
        case 'Integer':
        case 'Float':
        {
          this.setUniform1f('user_' + name, value);
          break;
        }
        case 'Input':
        {
          var input = value;
          var _dim = input.size;
          var _size = utils.dimToTexSize({
            floatTextures: this.floatTextures,
            floatOutput: this.floatOutput
          }, _dim);
          gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.argumentsLength);
          gl.bindTexture(gl.TEXTURE_2D, argumentTexture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

          var _length = _size[0] * _size[1];

          var _formatArrayTransfer2 = this._formatArrayTransfer(value.value, _length),
            _valuesFlat = _formatArrayTransfer2.valuesFlat,
            _bitRatio = _formatArrayTransfer2.bitRatio;

          if (this.floatTextures) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, _size[0], _size[1], 0, gl.RGBA, gl.FLOAT, inputArray);
          } else {
            var _buffer = new Uint8Array(_valuesFlat.buffer);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, _size[0] / _bitRatio, _size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, _buffer);
          }

          if (!this.hardcodeConstants) {
            this.setUniform3iv('user_' + name + 'Dim', _dim);
            this.setUniform2iv('user_' + name + 'Size', _size);
          }
          this.setUniform1i('user_' + name + 'BitRatio', _bitRatio);
          this.setUniform1i('user_' + name, this.argumentsLength);
          break;
        }
        case 'HTMLImage':
        {
          var inputImage = value;
          var _dim2 = [inputImage.width, inputImage.height, 1];
          var _size2 = [inputImage.width, inputImage.height];

          gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.argumentsLength);
          gl.bindTexture(gl.TEXTURE_2D, argumentTexture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          var mipLevel = 0;
          var internalFormat = gl.RGBA;
          var srcFormat = gl.RGBA;
          var srcType = gl.UNSIGNED_BYTE;
          gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, srcFormat, srcType, inputImage);
          this.setUniform3iv('user_' + name + 'Dim', _dim2);
          this.setUniform2iv('user_' + name + 'Size', _size2);
          this.setUniform1i('user_' + name, this.argumentsLength);
          break;
        }
        case 'HTMLImageArray':
        {
          var inputImages = value;
          var _dim3 = [inputImages[0].width, inputImages[0].height, inputImages.length];
          var _size3 = [inputImages[0].width, inputImages[0].height];

          gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.argumentsLength);
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, argumentTexture);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          var _mipLevel = 0;
          var _internalFormat = gl.RGBA;
          var width = inputImages[0].width;
          var height = inputImages[0].height;
          var textureDepth = inputImages.length;
          var border = 0;
          var _srcFormat = gl.RGBA;
          var _srcType = gl.UNSIGNED_BYTE;
          gl.texImage3D(gl.TEXTURE_2D_ARRAY, _mipLevel, _internalFormat, width, height, textureDepth, border, _srcFormat, _srcType, null);
          for (var i = 0; i < inputImages.length; i++) {
            var xOffset = 0;
            var yOffset = 0;
            var imageDepth = 1;
            gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, _mipLevel, xOffset, yOffset, i, inputImages[i].width, inputImages[i].height, imageDepth, _srcFormat, _srcType, inputImages[i]);
          }
          this.setUniform3iv('user_' + name + 'Dim', _dim3);
          this.setUniform2iv('user_' + name + 'Size', _size3);
          this.setUniform1i('user_' + name, this.argumentsLength);
          break;
        }
        case 'Texture':
        {
          var inputTexture = value;
          var _dim4 = inputTexture.dimensions;
          var _size4 = inputTexture.size;

          gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.argumentsLength);
          gl.bindTexture(gl.TEXTURE_2D, inputTexture.texture);

          this.setUniform3iv('user_' + name + 'Dim', _dim4);
          this.setUniform2iv('user_' + name + 'Size', _size4);
          this.setUniform1i('user_' + name + 'BitRatio', 1);
          this.setUniform1i('user_' + name, this.argumentsLength);
          break;
        }
        default:
          throw new Error('Input type not supported (WebGL): ' + value);
      }
      this.argumentsLength++;
    }
    _formatArrayTransfer(value, length) {
      var bitRatio = 1;
      var valuesFlat = value;
      if (utils.isArray(value[0]) || this.floatTextures) {
        valuesFlat = new Float32Array(length);
        utils.flattenTo(value, valuesFlat);
      } else {

        switch (value.constructor) {
          case Uint8Array:
          case Int8Array:
            bitRatio = 4;
            break;
          case Uint16Array:
          case Int16Array:
            bitRatio = 2;
          case Float32Array:
          case Int32Array:
            break;

          default:
            valuesFlat = new Float32Array(length);
            utils.flattenTo(value, valuesFlat);
        }
      }
      return {
        bitRatio: bitRatio,
        valuesFlat: valuesFlat
      };
    }
    getArgumentTexture(name) {
      return this.getTextureCache('ARGUMENT_' + name);
    }
    getTextureCache(name) {
      if (this.textureCache.hasOwnProperty(name)) {
        return this.textureCache[name];
      }
      return this.textureCache[name] = this._webGl.createTexture();
    }
    getOutputTexture() {
      return this.outputTexture;
    }
    renderOutput(outputTexture) {
      var texSize = this.texSize;
      var gl = this._webGl;
      var threadDim = this.threadDim;
      var output = this.output;
      if (this.outputToTexture) {
        return new Texture(outputTexture, texSize, this.threadDim, output, this._webGl);
      } else {
        var result = void 0;
        if (this.floatOutput) {
          var w = texSize[0];
          var h = Math.ceil(texSize[1] / 4);
          result = new Float32Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, result);
        } else {
          var bytes = new Uint8Array(texSize[0] * texSize[1] * 4);
          gl.readPixels(0, 0, texSize[0], texSize[1], gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          result = new Float32Array(bytes.buffer);
        }

        result = result.subarray(0, threadDim[0] * threadDim[1] * threadDim[2]);

        if (output.length === 1) {
          return result;
        } else if (output.length === 2) {
          return utils.splitArray(result, output[0]);
        } else if (output.length === 3) {
          var cube = utils.splitArray(result, output[0] * output[1]);
          return cube.map(function (x) {
            return utils.splitArray(x, output[0]);
          });
        }
      }
    }
    updateMaxTexSize() {
      var texSize = this.texSize;
      var canvas = this._canvas;
      if (this.maxTexSize === null) {
        var canvasIndex = canvases.indexOf(canvas);
        if (canvasIndex === -1) {
          canvasIndex = canvases.length;
          canvases.push(canvas);
          maxTexSizes[canvasIndex] = [texSize[0], texSize[1]];
        }
        this.maxTexSize = maxTexSizes[canvasIndex];
      }
      if (this.maxTexSize[0] < texSize[0]) {
        this.maxTexSize[0] = texSize[0];
      }
      if (this.maxTexSize[1] < texSize[1]) {
        this.maxTexSize[1] = texSize[1];
      }
    }
    _setupOutputTexture() {
      var gl = this._webGl;
      var texSize = this.texSize;
      var texture = this.outputTexture = this._webGl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + this.constantsLength + this.paramNames.length);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      if (this.floatOutput) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texSize[0], texSize[1], 0, gl.RGBA, gl.FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize[0], texSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
    detachTextureCache(name) {
      delete this.textureCache[name];
    }
    setUniform1f(name, value) {
      if (this.uniform1fCache.hasOwnProperty(name)) {
        var cache = this.uniform1fCache[name];
        if (value === cache) {
          return;
        }
      }
      this.uniform1fCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform1f(loc, value);
    }
    setUniform1i(name, value) {
      if (this.uniform1iCache.hasOwnProperty(name)) {
        var cache = this.uniform1iCache[name];
        if (value === cache) {
          return;
        }
      }
      this.uniform1iCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform1i(loc, value);
    }
    setUniform2f(name, value1, value2) {
      if (this.uniform2fCache.hasOwnProperty(name)) {
        var cache = this.uniform2fCache[name];
        if (value1 === cache[0] && value2 === cache[1]) {
          return;
        }
      }
      this.uniform2fCache[name] = [value1, value2];
      var loc = this.getUniformLocation(name);
      this._webGl.uniform2f(loc, value1, value2);
    }
    setUniform2fv(name, value) {
      if (this.uniform2fvCache.hasOwnProperty(name)) {
        var cache = this.uniform2fvCache[name];
        if (value[0] === cache[0] && value[1] === cache[1]) {
          return;
        }
      }
      this.uniform2fvCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform2fv(loc, value);
    }
    setUniform2iv(name, value) {
      if (this.uniform2ivCache.hasOwnProperty(name)) {
        var cache = this.uniform2ivCache[name];
        if (value[0] === cache[0] && value[1] === cache[1]) {
          return;
        }
      }
      this.uniform2ivCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform2iv(loc, value);
    }
    setUniform3fv(name, value) {
      if (this.uniform3fvCache.hasOwnProperty(name)) {
        var cache = this.uniform3fvCache[name];
        if (value[0] === cache[0] && value[1] === cache[1] && value[2] === cache[2]) {
          return;
        }
      }
      this.uniform3fvCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform3fv(loc, value);
    }
    setUniform3iv(name, value) {
      if (this.uniform3ivCache.hasOwnProperty(name)) {
        var cache = this.uniform3ivCache[name];
        if (value[0] === cache[0] && value[1] === cache[1] && value[2] === cache[2]) {
          return;
        }
      }
      this.uniform3ivCache[name] = value;
      var loc = this.getUniformLocation(name);
      this._webGl.uniform3iv(loc, value);
    }
  };
  Kernel.Input = Input;
  Kernel.Texture = Texture;
  return kernelRunShortcut(new Kernel());
};