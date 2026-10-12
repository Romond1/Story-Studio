const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText;
require('./translation-lifetime.test.cjs');
test('caption IPC denies Presenter inference and strips private fields from published envelope', async () => {
  const handlers = new Map(), sent = [];
  const makeWindow = () => ({ isDestroyed: () => false, webContents: { mainFrame: {}, isDestroyed: () => false, send: (channel, value) => sent.push({ channel, value }) } });
  const control = makeWindow(), present = makeWindow();
  const sharedContext = { exports: {} }; vm.runInNewContext(compile('src/shared/translation.ts'), sharedContext);
  const context = { exports: {}, require: name => {
    if (name === 'electron') return { app: { getPath: () => 'userdata', on() {} }, ipcMain: { handle: (name, fn) => handlers.set(name, fn) } };
    if (name === './translation/service') return { TranslationService: class { cancel() {} run() { return 'private'; } } };
    if (name === '../shared/translation') return sharedContext.exports;
    return require(name);
  } };
  vm.runInNewContext(compile('src/main/translationBroadcast.ts'), context); context.exports.installTranslationBroadcast(() => control, () => present);
  const event = win => ({ sender: win.webContents, senderFrame: win.webContents.mainFrame });
  assert.throws(() => handlers.get('translation:run')(event(present), {}), /Only Control/);
  assert.throws(() => handlers.get('translation:caption-get')(event(control)), /Only Presenter/);
  assert.throws(() => handlers.get('translation:publish')({ ...event(control), senderFrame: {} }, null), /Only Control/);
  handlers.get('translation:publish')(event(control), { language: 'ja', mode: 'furigana', fontSize: 36, position: 'top', transcript: 'PRIVATE', tokens: [{ text: '猫', reading: 'ねこ', private: 'SECRET' }] });
  assert.equal(JSON.stringify(sent).includes('PRIVATE'), false); assert.equal(JSON.stringify(sent).includes('SECRET'), false);
  handlers.get('translation:publish')(event(control), null); assert.equal(handlers.get('translation:caption-get')(event(present)), null);
});


