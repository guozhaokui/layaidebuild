
import * as ts from 'typescript'
import * as chokidir  from 'chokidar';
import * as path from 'path'
import * as fs from 'fs'
import { buildpath } from './watchShader';

function isInPath( file:string, testpath:string){
    return !(path.relative(testpath,file).startsWith('.')); //不是 ..开头，就是在testpath目录下
}

//TODO 加上排除 node_modules的功能
// 不能用依赖（shaders）来排除，会有时序问题
export function watchTranspile(projpath:string,outpath:string){
    chokidir.watch(projpath).on('all', (event, file) => {
        if( path.extname(file).toLowerCase()==='.ts'&& 
        !isInPath(file,outpath) ){
            if(event==='add' || event==='change'){
                let tsStr = fs.readFileSync(file).toString();
                let relout = path.relative(projpath,file);// 不用posix是因为不认盘符
				// 创建目录
				buildpath(outpath,path.dirname(relout));
				
				// 转换
				let result = ts.transpileModule(tsStr,{ compilerOptions: { 
					module: ts.ModuleKind.ESNext ,
					renamedDependencies:null,//[],
					transformers: null// {}
				}});

				let outfile = path.posix.join(outpath,relout);
				outfile = outfile.substr(0,outfile.length-3)+'.js';
                fs.writeFileSync(outfile,result.outputText);
            }
            console.log('更新文件('+event+'): ',file);
        }
    });
}
