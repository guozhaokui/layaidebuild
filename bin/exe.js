#!/usr/bin/env node
var watchMain = require('../src/watch/index').watchMain;

function help(){
    console.log('用法：');
    console.log('   layaidebuild 项目目录');
}

//console.log('args ', ...process.argv);

if (process.argv.length < 3) {
    help();
    process.exit(1);
}

process.argv.forEach((v,i,arr)=>{
    if(v.charAt(0)==='-'){
        switch(v){
        case '-cout':
            break;
        default:
            console.error( '错误：不认识的参数 '+v);
            console.log(`
            `);
            help();
            process.exit(1);
        }
    }
});

watchMain(process.argv[2])
