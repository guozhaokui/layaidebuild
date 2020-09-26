"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * AST Transformer to rewrite any ImportDeclaration paths.
 * This is typically used to rewrite relative imports into absolute imports
 * and mitigate import path differences w/ metaserver
 */
const ts = require("typescript");
const path = require("path");
const watchShader_1 = require("./watchShader");
/**
 * Rewrite relative import to absolute import or trigger
 * rewrite callback
 *  把import的路径根据baseUrl整理一下，加上扩展名，记录需要的是shader文件
 *
 * @param {string} importPath import path
 * @param {ts.SourceFile} sf Source file
 * @param shaders 当前监控的shader文件
 * @returns
 */
function rewritePath(importPath, sf, config, shaders) {
    let ret = importPath;
    let ext = path.extname(importPath).toLowerCase();
    if (!ext)
        ret += '.js';
    if (path.isAbsolute(ret) || importPath.startsWith('.')) {
    }
    else {
        if (config.options.baseUrl) {
            let baseurl = config.options.baseUrl.trim();
            if (baseurl.endsWith('/')) {
                ret = baseurl + ret;
            }
            else {
                ret = baseurl + '/' + ret;
            }
            ret = path.posix.relative(path.dirname(sf.fileName), ret);
        }
        //console.log(config.options.baseUrl, ret)
        //let out = ts.getOutputFileNames(config,sf.fileName,false);
    }
    // 记录shader
    if (watchShader_1.isShader(ext)) {
        let shaderfile = path.posix.join(path.dirname(sf.fileName), ret);
        let dict = shaders;
        if (!dict[shaderfile]) {
            dict[shaderfile] = true;
            //chokidir.watch(shaderfile).on('all', (event, path) => {
            //    console.log(event, path);
            //  });
        }
    }
    return ret;
    /*
    const aliases = Object.keys(regexps)
    for (const alias of aliases) {
        const regex = regexps[alias]
        if (regexps[alias].test(importPath)) {
            return importPath.replace(regex, opts.alias[alias])
        }
    }

    if (typeof opts.rewrite === 'function') {
        const newImportPath = opts.rewrite(importPath, sf.fileName)
        if (newImportPath) {
            return newImportPath
        }
    }

    if (opts.project && opts.projectBaseDir && importPath.startsWith('.')) {
        //const path = resolve(dirname(sf.fileName), importPath).split(opts.projectBaseDir)[1]
        //return `${opts.project}${path}`
    }

    return importPath
    */
}
function isDynamicImport(node) {
    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}
/**
 * visitor. ts节点遍历函数。 这个给 visitor增加了几个参数
 * @param ctx
 * @param sf      SourceFile 对象
 * @param config  ParsedCommandLine
 * @param shaders  当前监控的shader文件
 *
 */
function importExportVisitor(ctx, sf, config, shaders) {
    const visitor = (node) => {
        let importPath;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            const importPathWithQuotes = node.moduleSpecifier.getText(sf);
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2);
        }
        else if (isDynamicImport(node)) {
            const importPathWithQuotes = node.arguments[0].getText(sf);
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2);
        }
        else if (ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)) {
            importPath = node.argument.literal.text; // `.text` instead of `getText` bc this node doesn't map to sf (it's generated d.ts)
        }
        // 当前节点是一个import， 例如importPath是 ../../ILaya
        if (importPath) {
            //console.log('import', importPath)
            const rewrittenPath = rewritePath(importPath, sf, config, shaders);
            let ext = path.extname(rewrittenPath).toLowerCase();
            if (ext !== '.js') {
                // 非js的都作为字符串
            }
            const newNode = ts.getMutableClone(node);
            // Only rewrite relative path
            // 如果修改了import
            if (rewrittenPath !== importPath) {
                if (ts.isImportDeclaration(newNode) || ts.isExportDeclaration(newNode)) {
                    newNode.moduleSpecifier = ts.createLiteral(rewrittenPath);
                }
                else if (isDynamicImport(newNode)) {
                    newNode.arguments = ts.createNodeArray([ts.createStringLiteral(rewrittenPath)]);
                }
                else if (ts.isImportTypeNode(newNode)) {
                    newNode.argument = ts.createLiteralTypeNode(ts.createStringLiteral(rewrittenPath));
                }
                return newNode;
            }
        }
        return ts.visitEachChild(node, visitor, ctx);
    };
    return visitor;
}
function transform(config, shaders) {
    /*
    const { alias = {} } = opts
    const regexps: Record<string, RegExp> = Object.keys(alias).reduce(
        (all, regexString) => {
            all[regexString] = new RegExp(regexString, 'gi')
            return all
        },
        {} as Record<string, RegExp>
    )
    */
    return (ctx) => {
        return (sf) => {
            //console.log('file', sf.fileName);
            return ts.visitNode(sf, importExportVisitor(ctx, sf, config, shaders));
        };
    };
}
exports.transform = transform;
