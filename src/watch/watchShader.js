"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchShader = exports.buildpath = exports.isShader = void 0;
const chokidir = require("chokidar");
const path = require("path");
const fs = require("fs");
function isShader(lowerext) {
    return ['.vs', '.ps', '.fs', '.glsl'].indexOf(lowerext) >= 0;
}
exports.isShader = isShader;
function buildpath(projpath, relpath) {
    let pathes = relpath.split(/[\\/]/);
    let cpath = projpath;
    for (let i = 0; i < pathes.length; i++) {
        cpath = path.posix.join(cpath, pathes[i]);
        if (!fs.existsSync(cpath)) {
            fs.mkdirSync(cpath);
        }
    }
}
exports.buildpath = buildpath;
function isInPath(file, testpath) {
    return !(path.relative(testpath, file).startsWith('.')); //不是 ..开头，就是在testpath目录下
}
//TODO 加上排除 node_modules的功能
// 不能用依赖（shaders）来排除，会有时序问题
function watchShader(projpath, shaders, outpath) {
    chokidir.watch(projpath).on('all', (event, file) => {
        if (isShader(path.extname(file).toLowerCase()) &&
            !isInPath(file, outpath)) {
            if (event === 'add' || event === 'change') {
                let shaderc = fs.readFileSync(file).toString();
                shaderc = 'export default \`' + shaderc + '\`';
                let relout = path.relative(projpath, file); // 不用posix是因为不认盘符
                // 创建目录
                buildpath(outpath, path.dirname(relout));
                // 注意现在都转成js，否则不是js文件import会失败
                let outfile = path.posix.join(outpath, relout) + '.js';
                fs.writeFileSync(outfile, shaderc);
            }
            console.log('更新(' + event + '): ', path.relative(projpath, file));
        }
    });
}
exports.watchShader = watchShader;
