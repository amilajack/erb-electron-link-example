// @flow
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import childProcess from 'child_process';
import electronLink from 'electron-link';

// Taken from https://github.com/atom/atom/blob/master/script/lib/generate-startup-snapshot.js
// @TODO: Generate for main and for renderer processes
(async () => {
  try {
    console.log('Generating snapshot `mksnapshot`');
    const baseDirPath = path.join(__dirname, '../../app');
    const repoRootPath = path.join(__dirname, '../..');
    const snapshotScript = await electronLink({
      baseDirPath,
      mainPath: path.join(baseDirPath, 'dist/renderer.prod.js'),
      cachePath: path.join(baseDirPath, 'dist/cache'),
      shouldExcludeModule: () => false
      // shouldExcludeModule: (modulePath) => excludedModules.has(modulePath)
    });

    const snapshotScriptPath = path.join(baseDirPath, 'dist/snapshot.js');
    fs.writeFileSync(snapshotScriptPath, snapshotScript);

    console.log('Verifying if snapshot can be executed via `mksnapshot`');
    let packagedAppPath;
    let nodeBundledInElectronPath;
    const verifySnapshotScriptPath = path.join(__dirname, 'VerifySnapshot.js');
    if (process.platform === 'darwin') {
      const executableName = 'ElectronReact';
      packagedAppPath = path.join(__dirname, '../../release')
      nodeBundledInElectronPath = path.join(packagedAppPath, 'mac/ElectronReact.app', 'Contents', 'MacOS', executableName);
    } else if (process.platform === 'win32') {
      nodeBundledInElectronPath = path.join(packagedAppPath, 'win/electronreact.exe');
    } else {
      nodeBundledInElectronPath = path.join(packagedAppPath, 'linux/electronreact');
    }
    childProcess.execFileSync(
      nodeBundledInElectronPath,
      [verifySnapshotScriptPath, snapshotScriptPath],
      { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: 1 }) }
    );

    const generatedStartupBlobPath = path.join(baseDirPath, 'dist', 'snapshot_blob.bin');
    console.log(`Generating startup blob at "${generatedStartupBlobPath}"`);
    childProcess.execFileSync(
      path.join(repoRootPath, 'node_modules', 'electron-mksnapshot', 'bin', 'mksnapshot'),
      ['--no-use_ic', snapshotScriptPath, '--startup_blob', generatedStartupBlobPath]
    );

    let startupBlobDestinationPath;
    if (process.platform === 'darwin') {
      startupBlobDestinationPath = `${packagedAppPath}/Contents/Frameworks/Electron Framework.framework/Resources/snapshot_blob.bin`;
    } else {
      startupBlobDestinationPath = path.join(packagedAppPath, 'snapshot_blob.bin');
    }

    console.log(`Moving generated startup blob into "${startupBlobDestinationPath}"`);
    fs.unlinkSync(startupBlobDestinationPath);
    fs.renameSync(generatedStartupBlobPath, startupBlobDestinationPath);
  } catch (e) {
    console.log(e);
  }
})();
