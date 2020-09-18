import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';


// One-liner for current directory
chokidar.watch('.').on('all', (event, path) => {
  console.log(event, path);
});