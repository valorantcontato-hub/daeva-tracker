// electron-builder remove `build` do package.json distribuído. A configuração da
// atualização de interface precisa existir também como metadado do app instalado.
export function uiRepository(pkg) {
  const source = pkg.daevaUpdates || pkg.build?.publish?.[0];
  if (!source || source.owner === 'SEU_USUARIO_GITHUB') return null;
  if (!/^[a-z\d][a-z\d-]*$/i.test(source.owner || '') || !/^[\w.-]+$/.test(source.repo || '')) return null;
  return { owner: source.owner, repo: source.repo };
}
