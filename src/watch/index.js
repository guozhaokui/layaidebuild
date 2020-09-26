"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const transform_1 = require("./transform");
const watchShader_1 = require("./watchShader");
class textfile {
    constructor() {
        this.version = 0;
    }
    /**
     * 加上导出写到输出目录
     */
    emit() {
    }
    onchange() {
        this.version++;
        this.emit();
    }
}
const formatHost = {
    getCanonicalFileName: path => path,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
};
function reportDiagnostics(diagnostics) {
    diagnostics.forEach(diagnostic => {
        let message = "Error";
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            message += ` ${diagnostic.file.fileName} (${line + 1},${character + 1})`;
        }
        message += ": " + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.log(message);
    });
}
/**
 * 读tsconfig.json配置文件
 * @param configFileName
 */
function readConfigFile(configFileName) {
    // Read config file
    const configFileText = fs.readFileSync(configFileName).toString();
    // Parse JSON, after removing comments. Just fancier JSON.parse
    const result = ts.parseConfigFileTextToJson(configFileName, configFileText);
    const configObject = result.config;
    if (!configObject) {
        reportDiagnostics([result.error]);
        process.exit(1);
        ;
    }
    // Extract config infromation
    const configParseResult = ts.parseJsonConfigFileContent(configObject, ts.sys, path.dirname(configFileName));
    if (configParseResult.errors.length > 0) {
        reportDiagnostics(configParseResult.errors);
        process.exit(1);
    }
    return configParseResult;
}
/**
 * watch 某个项目目录
 * @param projpath
 */
function watchMain(projpath) {
    (!path.isAbsolute(projpath)) && (projpath = path.posix.join(process.cwd(), projpath));
    const configPath = ts.findConfigFile(
    // "../",   // 相对于当前脚本的位置
    projpath, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) {
        throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    //console.log('config=',configPath)
    let config = readConfigFile(configPath);
    //console.log('config',config)
    let baseurl = config.options.baseUrl;
    let shaders = {};
    watchShader_1.watchShader(projpath, shaders, config.options.outDir);
    // TypeScript can use several different program creation "strategies":
    //  * ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    //  * ts.createSemanticDiagnosticsBuilderProgram
    //  * ts.createAbstractBuilder
    // The first two produce "builder programs". These use an incremental strategy
    // to only re-check and emit files whose contents may have changed, or whose
    // dependencies may have changes which may impact change the result of prior
    // type-check and emit.
    // The last uses an ordinary program which does a full type check after every
    // change.
    // Between `createEmitAndSemanticDiagnosticsBuilderProgram` and
    // `createSemanticDiagnosticsBuilderProgram`, the only difference is emit.
    // For pure type-checking scenarios, or when another tool/process handles emit,
    // using `createSemanticDiagnosticsBuilderProgram` may be more desirable.
    const createProgram = ts.createSemanticDiagnosticsBuilderProgram;
    let sys = ts.sys;
    let oldwrite = sys.writeFile;
    sys.writeFile = (path, data, writeByteOrderMark) => {
        //console.log('path=',path)
        oldwrite(path, data, writeByteOrderMark);
    };
    // Note that there is another overload for `createWatchCompilerHost` that takes
    // a set of root files.
    const host = ts.createWatchCompilerHost(configPath, {}, sys, createProgram, reportDiagnostic, reportWatchStatusChanged);
    // You can technically override any given hook on the host, though you probably
    // don't need to.
    // Note that we're assuming `origCreateProgram` and `origPostProgramCreate`
    // doesn't use `this` at all.
    const origCreateProgram = host.createProgram;
    host.createProgram = (rootNames, options, host, oldProgram) => {
        // rootNames 是项目中所以有的ts文件
        return origCreateProgram(rootNames, options, host, oldProgram);
    };
    const origPostProgramCreate = host.afterProgramCreate;
    host.afterProgramCreate = program => {
        console.log("开始编译... ");
        //program.emit() 这里可以设置transformer
        let oldemit = program.emit;
        program.emit = (targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers) => {
            // 每个文件的输出。文件修改以后也都会调用到这里
            //console.log('emit:', targetSourceFile);
            return oldemit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, {
                after: [
                    transform_1.transform(config, shaders)
                ],
                afterDeclarations: [transform_1.transform(config, shaders)]
            });
        };
        origPostProgramCreate(program);
    };
    // `createWatchProgram` creates an initial program, watches files, and updates
    // the program over time.
    ts.createWatchProgram(host);
}
exports.watchMain = watchMain;
/**
 * 报告错误
 * @param diagnostic
 */
function reportDiagnostic(diagnostic) {
    let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
}
/**
 * Prints a diagnostic every time the watch status changes.
 * This is mainly for messages like "Starting compilation" or "Compilation completed".
 */
function reportWatchStatusChanged(diagnostic) {
    console.info(ts.formatDiagnostic(diagnostic, formatHost));
}
//test
//watchMain(process.argv[2]);
