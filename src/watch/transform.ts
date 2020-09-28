/**
 * AST Transformer to rewrite any ImportDeclaration paths.
 * This is typically used to rewrite relative imports into absolute imports
 * and mitigate import path differences w/ metaserver
 */
import * as ts from 'typescript'
import * as path from 'path'
import * as chokidir  from 'chokidar';
import * as fs from 'fs'
import { isShader } from './watchShader';

export interface Opts {
    projectBaseDir?: string
    project?: string
    rewrite?(importPath: string, sourceFilePath: string): string
    alias?: Record<string, string>
}

/**
 * Rewrite relative import to absolute import or trigger
 * rewrite callback
 *  把import的路径根据baseUrl整理一下，加上扩展名，记录需要的是shader文件
 *  返回的路径必须是 .或者..开始
 * @param {string} importPath import path
 * @param {ts.SourceFile} sf Source file
 * @param shaders 当前监控的shader文件
 * @returns
 */
function rewritePath(importPath: string, sf: ts.SourceFile, config:ts.ParsedCommandLine, shaders:Object) {
    let ret = importPath;
	let ext = path.extname(importPath).toLowerCase();
	// 凡是不是.js扩展名的，包括没有扩展名和各种shader等，都直接加上.js
    if(ext!='.js')
        ret +='.js';

    if(path.isAbsolute(ret) || importPath.startsWith('.')){
        
    }else{
        if(config.options.baseUrl){
            let baseurl = config.options.baseUrl.trim();
            if(baseurl.endsWith('/')){
                ret = baseurl+ret;
            }else{
                ret = baseurl+'/'+ret;
            }
			ret = path.posix.relative(path.dirname(sf.fileName),ret);
			if(!ret.startsWith('.')){
				ret = './'+ret;
			}
        }
        //console.log(config.options.baseUrl, ret)
        //let out = ts.getOutputFileNames(config,sf.fileName,false);
    }

    // 记录shader
    if(isShader(ext) && shaders){
        let shaderfile = path.posix.join(path.dirname(sf.fileName),ret);
        let dict = shaders as {[key:string]:boolean};
        if(!dict[shaderfile]){
            dict[shaderfile]=true;
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

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
}

/**
 * visitor. ts节点遍历函数。 这个给 visitor增加了几个参数
 * @param ctx 
 * @param sf      SourceFile 对象
 * @param config  ParsedCommandLine
 * @param shaders  当前监控的shader文件
 * 
 */
function importExportVisitor(
        ctx: ts.TransformationContext,
         sf: ts.SourceFile,
         config:ts.ParsedCommandLine,
         shaders:Object
) {
    
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
        let importPath: string
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            const importPathWithQuotes = node.moduleSpecifier.getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (isDynamicImport(node)) {
            const importPathWithQuotes = node.arguments[0].getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            importPath = node.argument.literal.text // `.text` instead of `getText` bc this node doesn't map to sf (it's generated d.ts)
        }

        // 当前节点是一个import， 例如importPath是 ../../ILaya
        if (importPath) {
			//console.log('import', importPath)
			// 应用baseUrl 转换成相对路径
            const rewrittenPath = rewritePath(importPath, sf, config,shaders)
            let ext = path.extname(rewrittenPath).toLowerCase();
            if(ext!=='.js'){
                // 非js的都作为字符串
            }

            const newNode = ts.getMutableClone(node)
            // Only rewrite relative path
            // 如果修改了import
            
            if (rewrittenPath !== importPath) {
                if (ts.isImportDeclaration(newNode) || ts.isExportDeclaration(newNode)) {
                    (newNode as any).moduleSpecifier = ts.createLiteral(rewrittenPath)
                } else if (isDynamicImport(newNode)) {
                    (newNode as any).arguments = ts.createNodeArray([ts.createStringLiteral(rewrittenPath)])
                } else if (ts.isImportTypeNode(newNode)) {
                    (newNode as any).argument = ts.createLiteralTypeNode(ts.createStringLiteral(rewrittenPath))
                }

                return newNode
            }
        }
        return ts.visitEachChild(node, visitor, ctx)
    }

    return visitor
}

export function transform(config:ts.ParsedCommandLine, shaders:Object): ts.TransformerFactory<ts.SourceFile> {
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
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) =>{ 
            //console.log('file', sf.fileName);
            return ts.visitNode(sf, importExportVisitor(ctx, sf, config, shaders))};
    }
}
