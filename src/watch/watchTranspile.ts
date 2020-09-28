
import * as ts from 'typescript'
import * as chokidir  from 'chokidar';
import * as path from 'path'
import * as fs from 'fs'
import { buildpath } from './watchShader';
import { transform } from './transform';

function isInPath( file:string, testpath:string){
    return !(path.relative(testpath,file).startsWith('.')); //不是 ..开头，就是在testpath目录下
}

/**
 * 转换器函数
 */
function simpleTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {
	return (context) => {
	  const visit: ts.Visitor = (node) => {
		if (ts.isDecorator(node)) {
		  return undefined;
		}
		return ts.visitEachChild(node, (child) => visit(child), context);
	  };
  
	  return (node) => ts.visitNode(node, visit);
	};
  }

//TODO 加上排除 node_modules的功能
// 不能用依赖（shaders）来排除，会有时序问题
export function watchTranspile(projpath:string, config: ts.ParsedCommandLine){
	let importTransform = transform(config,null);
	let outpath = config.options.outDir;
    chokidir.watch(projpath).on('all', (event, file) => {
		file = file.trimRight();
		let ext = file.substr(file.length-5).toLowerCase();
		// d.ts文件不会输出js，会导致transpile报错
		if(ext==='.d.ts') return;
        if( ext.substr(2)==='.ts'&& !isInPath(file,outpath) ){
            if(event==='add' || event==='change'){
                let tsStr = fs.readFileSync(file).toString();
                let relout = path.relative(projpath,file);// 不用posix是因为不认盘符
				// 创建目录
				buildpath(outpath,path.dirname(relout));
				
				// 转换
				let result = ts.transpileModule(tsStr,{ compilerOptions: { 
					target: ts.ScriptTarget.ESNext,
					module: ts.ModuleKind.ESNext 
				},
				fileName:file,
				moduleName:file,
				renamedDependencies:{'engcls1':'engcls1kkk'},
				transformers: { after:[importTransform]}
				});

				let outfile = path.posix.join(outpath,relout);
				outfile = outfile.substr(0,outfile.length-3)+'.js';
                fs.writeFileSync(outfile,result.outputText);
            }
            console.log('更新文件('+event+'): ',file);
        }
    });
}
