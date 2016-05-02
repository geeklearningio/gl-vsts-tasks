import path = require('path');
import fs = require('fs-extra');
import tl = require('vsts-task-lib/task');
import yazl = require('yazl');
import micromatch = require('micromatch');

try {

    var zipRoot = tl.getPathInput("ZipRoot");
    var patterns: any = tl.getDelimitedInput("Contents", "\n").map((pattern) => path.join(zipRoot, pattern));
    var allFiles = tl.find(zipRoot);
    var zipPath = tl.getPathInput("TargetPath");
    var zipName = tl.getPathInput("ZipName");
    var zipFile = new yazl.ZipFile();

    zipFile.outputStream.pipe(fs.createWriteStream(path.join(zipPath, zipName)))
        .on("close", () =>{
            tl.setResult(tl.TaskResult.Succeeded, "Content zipped");
        })
        .on('error', (err)=> { 
            tl.setResult(tl.TaskResult.Failed, String(err));
        });

    var files = allFiles.filter(micromatch.filter(patterns, { matchBase: true, nodupes: true }));

    console.log('zipping following files :');
    for (var index = 0; index < files.length; index++) {
        var file = files[index];
        console.log(file);
        zipFile.addFile(file, path.relative(zipRoot, file));
    }
    zipFile.end();

} catch (err) {
    tl.setResult(tl.TaskResult.Failed, String(err));
}